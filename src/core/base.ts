import path from "node:path";
import { getDirname } from "../utils/file";
import { type BaseClassConfig } from "./config/types";
import { BaseAutoload, BaseDi, BaseInitializer, di } from "./di/baseDi";
import { BaseLogger } from "./logger/baseLogger";

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
  private accessor logger: BaseLogger;

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
    console.log("Autoloading core library...", corePath);
    await BaseAutoload.autoload(corePath);
    console.log("***\n");

    console.log("Autoloading user code...", this.fsRoot);
    await BaseAutoload.autoload(this.fsRoot, []);
    console.log("***\n");

    await BaseInitializer.run();

    this.logger.info("Base system initialized 12345 n51de e20 1aj", ["e20 1aj"], { thing: "e20 1aj", anotherThing: "12345" });
  }

  // private initLogger() {
  //   BaseLogger.init(BaseConfig.getNamespace("logger"));

  //   this._logger = new BaseLogger("base");

  //   process.on("uncaughtException", (err) => {
  //     this.logger.fatal("Uncaught Exception", [], { err });
  //   });

  //   process.on("unhandledRejection", (reason, promise) => {
  //     this.logger.fatal("Unhandled Rejection", [], { promise, reason });
  //   });
  // }

  // private async initConfig() {
  //   await BaseConfig.init();
  // }

  // private initRequestHandler() {
  //   BaseDi.register(new BaseRequestHandler());
  // }

  // private initPubSub() {
  //   BaseDi.register(new BasePubSub());
  // }

  // async init() {


  //   await this.initConfig();
    
  //   this.initLogger();

  //   const config = BaseConfig.getNamespace<{ autoload?: boolean }>("base");

  //   // Check if autoload should have been disabled (for future optimization)
  //   const autoLoad = config.autoload === undefined || config.autoload;
  //   if (!autoLoad) {
  //     console.log("WARNING: autoload is disabled in config, but we had to run it anyway for the new config system");
  //   }

  //   this.initPubSub();
  //   this.initRequestHandler();

  //   BaseDi.register(this);

  //   const registeredModules = getRegisteredModules();
  //   for (const moduleClass of registeredModules) {
  //     this.addModule(moduleClass);
  //   }

  //   const bus = BaseDi.create().resolve<BasePubSub>("BasePubSub");
  //   if (!bus) throw new Error("BasePubSub is not registered.");

  //   void bus.pub("/base/init", { context: new BaseInitContext() });

  //   void this.go();
  // }

  // addModule<T extends BaseModule>(moduleConstructor: new () => T) {
  //   const module = new moduleConstructor();
  //   BaseDi.register(module);
  // }

  // async go() {
  //   const requestHandler =
  //     BaseDi.create().resolve<BaseRequestHandler>("BaseRequestHandler");
  //   if (!requestHandler)
  //     throw new Error("BaseRequestHandler is not registered.");
  //   await requestHandler.go();
  // }
}
