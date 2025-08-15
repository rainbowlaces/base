import path from "node:path";
import { getDirname } from "../utils/file.js";
import { BaseClassConfig, type ConfigData } from "./config/types.js";
import { BaseAutoload, BaseDi, BaseInitializer, di } from "./di/baseDi.js";
import { BaseLogger } from "./logger/baseLogger.js";
import { BasePubSub } from "./pubsub/basePubSub.js";

class BaseMainConfig extends BaseClassConfig {
  port: number = 3000;
  autoloadIgnore: string[] = [];
  autoload: boolean = true;
  // When true, once shutdown begins we strip additional signal listeners
  // (SIGINT/SIGTERM/SIGQUIT/SIGUSR2) and install no-op guards to avoid
  // duplicate shutdown paths from third-party libs.
  strictSignals: boolean = true;
}

declare module "./config/types.js" {
  interface BaseAppConfig {
    Base?: ConfigData<BaseMainConfig>;
  }
}

export class Base {
  private fsRoot: string;
  private libRoot: string;
  private isShuttingDown = false;
  private strictSignalsEnabled: boolean = true;
  private shutdownByIpc: boolean = false;

  @di<BaseLogger>(BaseLogger, "base")
  private accessor logger!: BaseLogger;

  @di<BasePubSub>(BasePubSub)
  private accessor pubsub!: BasePubSub;

  static start(metaUrl: string) {
    const base = new Base(metaUrl);
    return base.init();
  }

  constructor(metaUrl: string) {
    this.fsRoot = getDirname(metaUrl);
    this.libRoot = getDirname(import.meta.url);

    // Note: Using console.debug here since logger isn't available yet during DI setup
    console.debug(`[Base] Registering fsRoot: ${this.fsRoot}`);
    console.debug(`[Base] Registering libRoot: ${this.libRoot}`);

    BaseDi.register(this.fsRoot, "fsRoot");
    BaseDi.register(this.libRoot, "libRoot");
    BaseDi.register(process.env.NODE_ENV ?? "production", "env");
  }

  get config(): BaseMainConfig {
    return BaseDi.resolve<BaseMainConfig>("Config.Base");
  }

  async init() {
    const corePath = path.dirname(this.libRoot);
    await BaseAutoload.autoload(corePath);
    await BaseAutoload.autoload(this.fsRoot, ["*/public/*"]);

    process.on("uncaughtException", (err) => {
      this.logger.fatal("Uncaught Exception", [], { err });
    });

    process.on("unhandledRejection", (reason, promise) => {
      this.logger.fatal("Unhandled Rejection", [], { promise, reason });
    });

  // Handle graceful shutdown signals
  // Use prependOnceListener so our handler runs before any other user-land listeners
  process.prependOnceListener("SIGTERM", () => {
      this.logger.info(
        "Received SIGTERM signal, initiating graceful shutdown",
        []
      );
      void this.shutdown();
    });

  process.prependOnceListener("SIGINT", () => {
      this.logger.info(
        "Received SIGINT signal (Ctrl+C), initiating graceful shutdown",
        []
      );
      void this.shutdown();
    });

  process.prependOnceListener("SIGQUIT", () => {
      this.logger.info(
        "Received SIGQUIT signal, initiating graceful shutdown",
        []
      );
      void this.shutdown();
    });

    // Nodemon/debugger restart signal
  process.prependOnceListener("SIGUSR2", () => {
      this.logger.info(
        "Received SIGUSR2 signal, initiating graceful shutdown (nodemon)",
        []
      );
      void this.shutdown();
    });

    // Prefer explicit IPC message from the CLI to avoid clashes with library signal hooks
  if (typeof process.on === "function") {
      try {
        process.on("message", (msg: unknown) => {
          if (msg === "START_GRACEFUL_SHUTDOWN") {
      this.shutdownByIpc = true;
            this.logger.info(
              "Received shutdown message (IPC), initiating graceful shutdown",
              []
            );
            void this.shutdown();
          }
        });
      } catch {
        // ignore if IPC is not available
      }
    }

    BaseDi.register(this);

    await BaseInitializer.run();

    // Cache config needed during shutdown to avoid DI lookups later
    try {
      this.strictSignalsEnabled = this.config.strictSignals;
    } catch {
      this.strictSignalsEnabled = true;
    }

    this.logger.debug("Base initialized", []);
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn(
        "Shutdown already in progress, ignoring duplicate signal",
        []
      );
      return;
    }

    this.isShuttingDown = true;
    this.logger.info("Starting graceful shutdown process", []);

    // Optional hard mode: prevent duplicate shutdown paths from other listeners
  if (this.strictSignalsEnabled && !this.shutdownByIpc) {
      try {
        const signals: NodeJS.Signals[] = [
          "SIGINT",
          "SIGTERM",
          "SIGQUIT",
          "SIGUSR2",
        ];
        for (const sig of signals) {
          // Remove all remaining listeners for subsequent signals
          process.removeAllListeners(sig);
          // Install a no-op guard so future signals during shutdown don't trigger anything else
          process.on(sig, () => {
            // Keep it minimal to avoid noisy logs while tearing down
          });
        }
      } catch {
        // Best-effort; ignore errors removing listeners
      }
    }

    try {
      // Teardown all services in reverse dependency order
      await BaseDi.teardown();
      console.log("All services have been torn down successfully");
      // Prefer letting the event loop drain so logs flush cleanly
      process.exitCode = 0;
    } catch (error) {
      console.error("Error during graceful shutdown:", error);
      process.exitCode = 1;
    } finally {
      // Fallback: force exit after a short grace period in case handles remain open
      // This preserves previous behavior while giving I/O a chance to flush
      // Give the process a bit more time by default to allow teardown logs to flush
      // and async cleanups (e.g., containers) to complete. Can be overridden via env.
  const timeout = Number(process.env.BASE_SHUTDOWN_TIMEOUT_MS ?? 4000);
      setTimeout(() => {
        // Only force if still running
        try {
          process.exit(process.exitCode ?? 0);
        } catch {
          // ignore
        }
      }, timeout).unref();
    }
  }
}
