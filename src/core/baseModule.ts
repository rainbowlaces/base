import BaseLogger from "./logger";
import { camelToLowerUnderscore } from "../utils/string";
import BaseConfig from "./config";
import BasePubSub from "./basePubSub";
import di from "../decorators/di";
import { BaseTopicCheck } from "./baseReadyCheck";

export default abstract class BaseModule {
  private _namespace: string;

  private static dependsOn: string[] = [];

  @di<BasePubSub>("BasePubSub")
  private _bus!: BasePubSub;

  private _logger: BaseLogger;
  private _config: BaseConfig;

  deps = new BaseTopicCheck(
    this.dependsOn,
    (dep: string) => `/modules/${dep}/initialized`,
  );

  constructor() {
    this._namespace = camelToLowerUnderscore(this.constructor.name);
    this._logger = new BaseLogger(this._namespace);
    this._config = new BaseConfig(this._namespace);

    this._logger.info("Loaded");

    if (!this.dependsOn.length) return;
  }

  protected get logger() {
    return this._logger;
  }

  protected get config() {
    return this._config;
  }

  protected get namespace() {
    return this._namespace;
  }

  get dependsOn() {
    return (this.constructor as typeof BaseModule).dependsOn;
  }
}
