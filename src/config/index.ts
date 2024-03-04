import path from "path";
import { BaseConfigObject, ConfigObject } from "./types";

type NodeError = Error & {
  code: string;
};

/**
 * Manages application configurations by loading base and environment-specific configuration files.
 * Provides functionality to merge configurations and retrieve specific configuration namespaces.
 */
export default class Config {
  private _config: BaseConfigObject = {};
  private _fsRoot: string;
  private _env?: string;

  constructor(fsRoot: string, env?: string) {
    this._fsRoot = path.resolve(fsRoot);
    this._env = env;
  }

  private async load(config: string): Promise<BaseConfigObject> {
    const configFile = path.resolve(path.join(this._fsRoot, `${config}.js`));
    if (!configFile.startsWith(this._fsRoot)) {
      throw new Error("Invalid configuration file path.");
    }
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    return import(configFile).then(
      (module) => module.default as BaseConfigObject,
    );
  }

  public async init(): Promise<void> {
    const defaultConfig = await this.load("default");
    let envConfig: BaseConfigObject = {};
    if (this._env) {
      try {
        envConfig = await this.load(this._env);
      } catch (error) {
        const err = error as NodeError;
        if (err.code === "ERR_MODULE_NOT_FOUND") {
          console.warn(
            `Environment-specific(${this._env}) configuration not found.`,
          );
        } else {
          throw new Error(
            `Failed to load environment-specific(${this._env}) configuration. ${err.message}`,
          );
        }
      }
    }

    this._config = this.merge(defaultConfig, envConfig);
  }

  public getNamespace(ns: string): ConfigObject {
    return this._config[ns] ?? {};
  }

  private merge(
    base: BaseConfigObject,
    env: BaseConfigObject = {},
  ): BaseConfigObject {
    const out: BaseConfigObject = { ...base };
    for (const [ns, config] of Object.entries(env)) {
      out[ns] = { ...(out[ns] || {}), ...config };
    }
    return out;
  }
}
