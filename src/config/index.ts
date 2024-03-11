import path from "path";
import { ConfigObject } from "./types";
import { merge } from "../utils/recursion";

/**
 * Manages application configurations by loading base and environment-specific configuration files.
 * Provides functionality to merge configurations and retrieve specific configuration namespaces.
 */
export default class Config {
  private _config: ConfigObject = {};
  private _templates: ConfigObject = {};
  private _fsRoot: string;
  private _env?: string;

  constructor(fsRoot: string, env?: string) {
    this._fsRoot = path.resolve(fsRoot);
    this._env = env;
  }

  public async init(): Promise<void> {
    await this.loadTemplates();

    const baseConfig = await this.loadAndApplyTemplates("default");

    let envConfig: ConfigObject = {};
    if (this._env) {
      envConfig = await this.loadAndApplyTemplates(this._env);
    }

    this._config = merge(baseConfig, envConfig);
  }

  public getConfig(): ConfigObject {
    return this._config;
  }

  public getNamespace(ns: string): ConfigObject {
    return this._config[ns] ?? {};
  }

  private async load(config: string): Promise<ConfigObject> {
    const configFile = path.resolve(path.join(this._fsRoot, `${config}.js`));
    if (!configFile.startsWith(this._fsRoot)) {
      throw new Error("Invalid configuration file path.");
    }
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    return import(configFile).then((module) => module.default as ConfigObject);
  }

  private async loadTemplates(): Promise<void> {
    try {
      this._templates = await this.load("templates");
    } catch (error) {
      console.warn("No templates configuration found.");
    }
  }

  private async loadAndApplyTemplates(
    configName: string,
  ): Promise<ConfigObject> {
    let config = await this.load(configName);
    config = this.applyTemplatesToConfig(config);
    return config;
  }

  private applyTemplatesToConfig(config: ConfigObject): ConfigObject {
    const applyTemplatesRecursively = (obj: ConfigObject): ConfigObject => {
      if (typeof obj !== "object" || obj === null) return obj;

      // Initialize result from the template if specified, or start with an empty object

      let result: ConfigObject = {};
      if (obj._T) {
        const templateName = obj._T as string;
        const templateConfig = this._templates[templateName];
        if (templateConfig) result = templateConfig;
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
          result[key] = merge(result[key], applyTemplatesRecursively(value));
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
