import path from "node:path";
import { getDirname } from "../utils/file";
import { type BaseClassConfig } from "./config/types";
import { BaseAutoload, BaseDi, BaseInitializer, di } from "./di/baseDi";
import { BaseLogger } from "./logger/baseLogger";
import { BasePubSub } from "./pubsub/basePubSub";

interface BaseMainConfig extends BaseClassConfig {
  port?: number;
  autoloadIgnore?: string[];
  autoload?: boolean;
}

declare module "./config/types" {
  interface BaseAppConfig {
    Base?: BaseMainConfig;
  }
}

export class Base {

  private fsRoot: string;
  private libRoot: string;

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
    
    BaseDi.register(this.fsRoot, "fsRoot");
    BaseDi.register(this.libRoot, "libRoot");
    BaseDi.register(process.env.NODE_ENV, "env");
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

    BaseDi.register(this);

    await BaseInitializer.run();    

    this.logger.info("Base initialized", []);
  }
}
