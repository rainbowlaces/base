import { registerDi } from "../di/decorators/registerDi";
import { merge } from "../../utils/recursion";
import { BaseDi } from "../di/baseDi";
import { type BaseAppConfig } from "./types";

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

    for (const namespace in this.config) {
        if (Object.prototype.hasOwnProperty.call(this.config, namespace)) {
            
            // Get the specific config object for the module.
            const moduleConfig = this.config[namespace as keyof BaseAppConfig];
            if (!moduleConfig) continue;
            
            // Create a unique key. 'Config.ModuleName' is a good convention.
            const diKey = `Config.${namespace}`;

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