import path from "path";
import { type ConfigObject } from "./types";
import { merge } from "../../utils/recursion";
import fs, { constants } from "fs/promises";
import { register } from "../../decorators/register";

@register()
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
    const config = this.getConfig();
    const val: unknown = config[key];
    // Type assertion is necessary here because we're dealing with dynamic config loading
    // where values come from JS files and can be any type. The caller is responsible
    // for ensuring the type T matches the actual config value.
     
    return val !== undefined ? (val as T) : defaultValue;
  }

  public static getNamespace(ns: string): ConfigObject {
    // ConfigObject is Record<string, any> so accessing _config[ns] returns `any`
    // We can't avoid this without changing the fundamental type system of the config
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const namespaceConfig = this._config[ns];
    if (namespaceConfig === undefined) {
      return {};
    }
    // Must cast `any` back to ConfigObject since that's what we store and expect
    // Alternative would be to rewrite the entire config system with proper typing
     
    return namespaceConfig as ConfigObject;
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

    return import(configFile).then((module: { default?: ConfigObject }) => {
      return module.default ?? {};
    });
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
    // We need `any` here because we're processing dynamic config objects from JS files
    // that can contain arbitrary nested structures. TypeScript can't know the shape ahead of time.
    // Alternative: Create a proper config schema validation system, but that's a major rewrite.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyTemplatesRecursively = (obj: any): ConfigObject => {
      // We must return the primitive value as-is when it's not an object
      // TypeScript sees this as unsafe because `obj` is `any`, but it's the only way
      // to handle the recursive nature of unknown config structures
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      if (obj === null || typeof obj !== "object") return obj;

      let result: ConfigObject = {};
      // Accessing _T property on `any` type - unavoidable when processing dynamic JS objects
      // Alternative: Use proper type guards, but would require defining all possible config shapes
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (obj._T) {
        // Template name comes from user-defined JS config files, so it's inherently `any`
        // We trust that if _T exists, it's a string (this is our config convention)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const templateName = obj._T as string;
        // Templates are stored as ConfigObject but accessed via string key, returning `any`
        // This is the nature of Record<string, any> - we can't avoid it without major type refactoring
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const templateConfig = this._templates[templateName];
        // Spreading template config that's typed as `any` due to Record<string, any>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        if (templateConfig) result = { ...templateConfig };
      }

      // Object.keys() on `any` type - necessary for dynamic object processing
      // Alternative: Use proper type definitions for all config objects (massive undertaking)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      Object.keys(obj).forEach((key) => {
        if (key === "_T") {
          return;
        }

        // Property access on `any` type - unavoidable when processing dynamic structures
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const value = obj[key];
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          result[key] = merge(
            // Spreading potentially `any` typed values - required for deep merging dynamic configs
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            { ...result[key] },
            applyTemplatesRecursively({ ...value }),
          );
        } else {
          // Assigning `any` typed value - this is the fundamental limitation of dynamic config loading
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          result[key] = value;
        }
      });

      return result;
    };

    return applyTemplatesRecursively(config);
  }
}
