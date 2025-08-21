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
  private uncaughtHandlerRef?: (err: unknown) => void;
  private unhandledHandlerRef?: (reason: unknown, promise: Promise<unknown>) => void;

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

    console.debug(`Registering fsRoot: ${this.fsRoot}`);
    console.debug(`Registering libRoot: ${this.libRoot}`);

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

    this.uncaughtHandlerRef = (err) => {
      try {
        this.logger.error("Uncaught Exception", [], { err });
      } catch {
        console.error("Uncaught Exception (logger unavailable)", err);
      }
      process.exitCode = 1;
      if (!this.isShuttingDown) void this.shutdown();
    };
  process.on("uncaughtException", this.uncaughtHandlerRef);

    this.unhandledHandlerRef = (reason, promise) => {
      try {
        this.logger.error("Unhandled Rejection", [], { promise, reason });
      } catch {
        console.error(
          "[Base] Unhandled Rejection (logger unavailable)",
          reason
        );
      }
      process.exitCode = 1;
      if (!this.isShuttingDown) void this.shutdown();
    };
  process.on("unhandledRejection", this.unhandledHandlerRef);

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

  process.prependOnceListener("SIGUSR2", () => {
      this.logger.info(
        "Received SIGUSR2 signal, initiating graceful shutdown (nodemon)",
        []
      );
      void this.shutdown();
    });

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
  this.logger.info("Starting graceful shutdown", []);
    try {
      BaseDi.register(true, "ShuttingDown");
    } catch {
      // ignore if DI not available
    }

    if (this.uncaughtHandlerRef) {
      process.removeListener("uncaughtException", this.uncaughtHandlerRef);
      this.uncaughtHandlerRef = undefined;
    }
    if (this.unhandledHandlerRef) {
      process.removeListener("unhandledRejection", this.unhandledHandlerRef);
      this.unhandledHandlerRef = undefined;
    }

  if (this.strictSignalsEnabled && !this.shutdownByIpc) {
      try {
        const signals: NodeJS.Signals[] = [
          "SIGINT",
          "SIGTERM",
          "SIGQUIT",
          "SIGUSR2",
        ];
        for (const sig of signals) {
          process.removeAllListeners(sig);
          process.on(sig, () => {
          });
        }
      } catch {
        // Best-effort; ignore errors removing listeners
      }
    }

    try {
      await BaseDi.teardown();
      console.log("All services have been torn down successfully");
      process.exitCode = process.exitCode ?? 0;
    } catch (error) {
      console.error("Error during graceful shutdown:", error);
      process.exitCode = 1;
    } finally {
      try {
        const anyProc = process as NodeJS.Process & { disconnect?: () => void; channel?: unknown };
        if (anyProc.channel && typeof anyProc.disconnect === 'function') {
          anyProc.disconnect();
          console.log('Disconnected IPC channel');
        }
      } catch {
        // ignore IPC disconnect errors
      }

      const timeout = Number(process.env.BASE_SHUTDOWN_TIMEOUT_MS ?? 4000);
  const forceTimer = setTimeout(() => {
        try {
          console.warn(`Forcing process exit after ${timeout}ms grace period (code=${process.exitCode ?? 0})`);
          process.exit(process.exitCode ?? 0);
        } catch {
          // ignore
        }
  }, timeout).unref();
      if (process.env.NODE_ENV === 'development' || process.env.TEST) {
        forceTimer.refresh();
        forceTimer.ref();
        setTimeout(() => {
          try {
            process.exit(process.exitCode ?? 0);
          } catch { /* ignore fast exit errors */ }
        }, 500);
      }
    }
  }
}
