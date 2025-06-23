import { BaseLogger } from "../core/logger";
import { BaseConfig } from "./config";
import { getDirname } from "../utils/file";
import { BaseDi } from "./baseDi";
import { BasePubSub } from "./basePubSub";
import { BaseModule } from "./baseModule";
import { BaseInitContext } from "./initContext";
import { BaseRequestHandler } from "./requestHandler";
import { getRegisteredModules } from "../decorators/baseModule";
import path from "node:path";

export class Base {
  private _logger!: BaseLogger;

  private _fsRoot: string;
  private _libRoot: string;

  static start(metaUrl: string) {
    const base = new Base(metaUrl);
    return base.init();
  }
  
  public get logger(): BaseLogger {
    return this._logger;
  }

  constructor(metaUrl: string) {
    this._fsRoot = getDirname(metaUrl);
    this._libRoot = getDirname(import.meta.url);
    BaseDi.register(this._fsRoot, "fsRoot");
    BaseDi.register(this._libRoot, "libRoot");
    BaseDi.register(process.env.NODE_ENV, "env");
  }

  private initLogger() {
    BaseLogger.init(BaseConfig.getNamespace("logger"));

    this._logger = new BaseLogger("base");

    process.on("uncaughtException", (err) => {
      this.logger.fatal("Uncaught Exception", [], { err });
    });

    process.on("unhandledRejection", (reason, promise) => {
      this.logger.fatal("Unhandled Rejection", [], { promise, reason });
    });

    BaseDi.register(BaseLogger);
  }

  private async initConfig() {
    await BaseConfig.init(this._fsRoot, process.env.NODE_ENV);
    BaseDi.register(BaseConfig);
  }

  private initRequestHandler() {
    BaseDi.register(new BaseRequestHandler());
  }

  private initPubSub() {
    BaseDi.register(new BasePubSub());
  }

  async init() {
    await this.initConfig();

    const config = BaseConfig.getNamespace("base");

    const autoLoad = config.autoload === undefined || config.autoload;

    if (autoLoad) {
      await BaseDi.autoload(path.dirname(this._libRoot));
      await BaseDi.autoload(this._fsRoot, config.autoloadIgnore || []);
    }

    this.initLogger();
    this.initPubSub();
    this.initRequestHandler();

    BaseDi.register(this);

    const registeredModules = getRegisteredModules();
    for (const ModuleClass of registeredModules) {
      this.addModule(ModuleClass);
    }

    const bus = BaseDi.create().resolve<BasePubSub>("BasePubSub");
    if (!bus) throw new Error("BasePubSub is not registered.");

    bus.pub("/base/init", { context: new BaseInitContext() });

    this.go();
  }

  addModule<T extends BaseModule>(Module: new () => T) {
    const module = new Module();
    BaseDi.register(module);
  }

  async go() {
    const requestHandler =
      BaseDi.create().resolve<BaseRequestHandler>("BaseRequestHandler");
    if (!requestHandler)
      throw new Error("BaseRequestHandler is not registered.");
    await requestHandler.go();
  }
}
