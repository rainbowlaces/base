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
    process.on("SIGTERM", () => {
      this.logger.info("Received SIGTERM signal, initiating graceful shutdown", []);
      void this.shutdown();
    });

    process.on("SIGINT", () => {
      this.logger.info("Received SIGINT signal (Ctrl+C), initiating graceful shutdown", []);
      void this.shutdown();
    });

    process.on("SIGQUIT", () => {
      this.logger.info("Received SIGQUIT signal, initiating graceful shutdown", []);
      void this.shutdown();
    });

    BaseDi.register(this);

    await BaseInitializer.run();    

    this.logger.debug("Base initialized", []);
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn("Shutdown already in progress, ignoring duplicate signal", []);
      return;
    }

    this.isShuttingDown = true;
    this.logger.info("Starting graceful shutdown process", []);

    try {
      // Teardown all services in reverse dependency order
      await BaseDi.teardown();
      console.log("All services have been torn down successfully");
      process.exit(0);
    } catch (error) {
      console.error("Error during graceful shutdown:", error);
      process.exit(1);
    }
  }
}
