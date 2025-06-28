import { BaseLogger } from "../core/logger";
import { BaseConfig } from "./config";
import { getDirname } from "../utils/file";
import { BaseDi } from "./baseDi";
import { BasePubSub } from "./basePubSub";
import { type BaseModule } from "./baseModule";
import { BaseInitContext } from "./initContext";
import { BaseRequestHandler } from "./requestHandler";
import { getRegisteredModules } from "../decorators/baseModule";
import path from "node:path";
import { di } from "../decorators/di";

export class Base {

  @di<BaseLogger>(BaseLogger, "base")
  private accessor _logger!: BaseLogger;

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
  }

  private async initConfig() {
    await BaseConfig.init(this._fsRoot, process.env.NODE_ENV);
  }

  private initRequestHandler() {
    BaseDi.register(new BaseRequestHandler());
  }

  private initPubSub() {
    BaseDi.register(new BasePubSub());
  }

  async init() {
    await this.initConfig();
    
    this.initLogger();

    const config = BaseConfig.getNamespace("base");

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const autoLoad = config.autoload === undefined || config.autoload;

    if (autoLoad) {
      console.log("Autoloading core modules...");
      await BaseDi.autoload(path.dirname(this._libRoot), ["*/testApp/*"]);
      console.log("***");

      console.log("Autoloading user modules...");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await BaseDi.autoload(this._fsRoot, config.autoloadIgnore ?? []);
      console.log("***");
    }

    this.initPubSub();
    this.initRequestHandler();

    BaseDi.register(this);

    const registeredModules = getRegisteredModules();
    for (const moduleClass of registeredModules) {
      this.addModule(moduleClass);
    }

    const bus = BaseDi.create().resolve<BasePubSub>("BasePubSub");
    if (!bus) throw new Error("BasePubSub is not registered.");

    void bus.pub("/base/init", { context: new BaseInitContext() });

    void this.go();
  }

  addModule<T extends BaseModule>(moduleConstructor: new () => T) {
    const module = new moduleConstructor();
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
