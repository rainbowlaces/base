import path from "path";
import { ConfigObject } from "./types";
import { merge } from "../../utils/recursion";

export default class BaseConfig {
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
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    return import(configFile).then((module) => module.default as ConfigObject);
  }

  private static async loadTemplates(): Promise<void> {
    try {
      this._templates = await this.load("templates");
    } catch (error) {
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

      // Initialize result from the template if specified, or start with an empty object

      let result: ConfigObject = {};
      if (obj._T) {
        const templateName = obj._T as string;
        const templateConfig = this._templates[templateName];
        if (templateConfig) result = { ...templateConfig };
      }

      // Iterate over the properties of the original object
      Object.keys(obj).forEach((key) => {
        if (key === "_T") {
          // Skip the template property itself
          return;
        }

        const value = obj[key];
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          // If the property is an object (and not an array), apply templates recursively
          result[key] = merge(
            { ...result[key] },
            applyTemplatesRecursively({ ...value }),
          );
        } else {
          // For other values, directly assign them to the result
          result[key] = value;
        }
      });

      // The initial version directly merged the obj, potentially missing the recursive template application
      // This new approach ensures each property is considered for template application or direct assignment
      return result;
    };

    // Starting point: apply templates to the top-level config object
    return applyTemplatesRecursively(config);
  }
}
