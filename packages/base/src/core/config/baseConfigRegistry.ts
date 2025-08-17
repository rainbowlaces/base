import { registerDi } from "../di/decorators/registerDi.js";
import { merge } from "../../utils/recursion.js";
import { BaseDi } from "../di/baseDi.js";
import { type BaseAppConfig } from "./types.js";
import { ConfigClassRegistry } from "./configClassRegistry.js";

export abstract class BaseConfigProvider {
  abstract get config(): Partial<BaseAppConfig>;
  constructor(public env: string = 'default', public priority: number = 0) {}
}

@registerDi()
export class BaseConfigRegistry {
  private static providers: BaseConfigProvider[] = [];

  static register(provider: BaseConfigProvider): void {
    this.providers.push(provider);
  }

  static clearProviders(): void {
    this.providers = [];
  }

  static getProviders(): BaseConfigProvider[] {
    return [...this.providers];
  }

  public readonly env: string;
  public readonly config: BaseAppConfig = {};

  constructor(env: string) {
    this.env = env.toLowerCase();
    const providers = BaseConfigRegistry.getProvidersForEnv(this.env);
    let mergedConfig: Partial<BaseAppConfig> = {};
    for (const provider of providers) {
      mergedConfig = merge(mergedConfig, provider.config);
    }
    this.config = mergedConfig as BaseAppConfig;

    // Get all registered config classes
  const allConfigClasses = ConfigClassRegistry.getAll();
    
    // Create instances for all registered config classes
    for (const [namespace, configClass] of allConfigClasses) {
      const diKey = `Config.${namespace}`;
      
      // Get the config data for this namespace (if any)
      const moduleConfig = this.config[namespace as keyof BaseAppConfig];
      
      // Create class instance and hydrate with config data (or empty object if no config)
      const instance = new configClass();
      instance.hydrate(moduleConfig ? moduleConfig as Partial<Record<string, unknown>> : {});
      
      // Register the class instance
      BaseDi.register(instance, { key: diKey, singleton: true, type: "scalar" });
    }

    // Handle any remaining config entries that don't have registered classes
    for (const namespace in this.config) {
        if (Object.prototype.hasOwnProperty.call(this.config, namespace)) {
            const diKey = `Config.${namespace}`;
            
            // Skip if we already registered this namespace above
            if (allConfigClasses.has(namespace)) continue;
            
            // Get the specific config object for the module.
            const moduleConfig = this.config[namespace as keyof BaseAppConfig];
            if (!moduleConfig) continue;
            
            // Register it as a scalar/value. It's just an object, not a class to be constructed.
            BaseDi.register(moduleConfig, { key: diKey, singleton: true, type: "scalar" });
        }
    }
  }

  private static getProvidersForEnv(env: string): BaseConfigProvider[] {
    return [...this.providers]
      .filter(p => p.env === 'default' || p.env === env)
      .sort((a, b) => a.priority - b.priority);
  }
}