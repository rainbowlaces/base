import BaseLogger from "../core/logger";
import BaseConfig from "./config";
import { getDirname } from "../utils/file";
import BaseDi from "./baseDi";
import BaseRequestHandler from "./baseRequestHandler";
import BasePubSub from "./basePubSub";
import BaseModule from "./baseModule";
import BaseStatic from "../modules/static";
import BaseTemplates from "../modules/templates";
import BaseRouter from "./baseRouter";

export default class Base {
  private _logger!: BaseLogger;

  private _config!: BaseConfig;
  private _bus!: BasePubSub;
  private _requestHandler!: BaseRequestHandler;

  private _fsRoot: string;
  private _libRoot: string;

  public get bus(): BasePubSub {
    return this._bus;
  }

  public get config(): BaseConfig {
    return this._config;
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

  private initRouter() {
    BaseDi.register(new BaseRouter());
  }

  private initRequestHandler() {
    this._requestHandler = new BaseRequestHandler();
    BaseDi.register(this._requestHandler);
  }

  private initPubSub() {
    this._bus = new BasePubSub();
    BaseDi.register(this._bus);
  }

  async init() {
    await this.initConfig();
    this.initLogger();
    this.initPubSub();
    this.initRouter();
    this.initRequestHandler();

    BaseDi.register(this);

    this.addModule(BaseStatic);
    this.addModule(BaseTemplates);

    this._bus.pub("/base/init");
  }

  addModule<T extends BaseModule>(Module: new () => T) {
    const module = new Module();
    BaseDi.register(module);
  }

  async go() {
    await this._requestHandler.go();
  }
}
