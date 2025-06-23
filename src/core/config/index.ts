import path from "path";
import { ConfigObject } from "./types";
import { merge } from "../../utils/recursion";
import fs, { constants } from "fs/promises";

export class BaseConfig {
  private static _config: ConfigObject = {};
  private static _templates: ConfigObject = {};

  private static _baseFsRoot: string;
  private static _fsRoot: string;
  private static _env?: string;

  private _ns: string;

  public static async init(baseFsRoot: string, env?: string): Promise<void> {
    this._baseFsRoot = path.resolve(baseFsRoot);
    this._fsRoot = path.resolve(path.join(this._baseFsRoot, "config"));
    this._env = env;

    await this.loadTemplates();

    const baseConfig = await this.loadAndApplyTemplates("default");

    let envConfig: ConfigObject = {};
    if (this._env) {
      envConfig = await this.loadAndApplyTemplates(this._env);
    }

    this._config = merge(baseConfig, envConfig);
  }

  public constructor(namespace: string) {
    this._ns = namespace;
  }

  public getConfig(): ConfigObject {
    return BaseConfig.getNamespace(this._ns);
  }

  public get<T = string>(key: string, defaultValue: T): T;
  public get<T = string>(key: string, defaultValue?: T): T | undefined {
    const val = this.getConfig()[key] as T;
    return val !== undefined ? val : defaultValue;
  }

  public static getNamespace(ns: string): ConfigObject {
    return this._config[ns] ?? {};
  }

  private static async load(config: string): Promise<ConfigObject> {
    const configFile = path.resolve(path.join(this._fsRoot, `${config}.js`));
    if (!configFile.startsWith(this._fsRoot)) {
      throw new Error("Invalid configuration file path.");
    }

    try {
      await fs.access(configFile, constants.R_OK);
    } catch (_error) {
      return {};
    }

    return import(configFile).then((module) => module.default as ConfigObject);
  }

  private static async loadTemplates(): Promise<void> {
    try {
      this._templates = await this.load("templates");
    } catch (_error) {
      console.warn("No templates configuration found.");
    }
  }

  private static async loadAndApplyTemplates(
    configName: string,
  ): Promise<ConfigObject> {
    let config = await this.load(configName);
    config = this.applyTemplatesToConfig(config);
    return config;
  }

  private static applyTemplatesToConfig(config: ConfigObject): ConfigObject {
    const applyTemplatesRecursively = (obj: ConfigObject): ConfigObject => {
      if (typeof obj !== "object" || obj === null) return obj;

      let result: ConfigObject = {};
      if (obj._T) {
        const templateName = obj._T as string;
        const templateConfig = this._templates[templateName];
        if (templateConfig) result = { ...templateConfig };
      }

      Object.keys(obj).forEach((key) => {
        if (key === "_T") {
          return;
        }

        const value = obj[key];
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          result[key] = merge(
            { ...result[key] },
            applyTemplatesRecursively({ ...value }),
          );
        } else {
          result[key] = value;
        }
      });

      return result;
    };

    return applyTemplatesRecursively(config);
  }
}
