import { type BaseAppConfig } from "./types.js";
import { registerDi } from "../di/decorators/registerDi.js";
import { BaseConfigRegistry } from "./baseConfigRegistry.js";
import { BaseDi } from "../di/baseDi.js";
import { type Constructor } from "../di/types.js";

@registerDi({ setup: true, phase: 10, singleton: true })
export class BaseConfig {
  private static config: BaseConfigRegistry;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getConfig<T extends Constructor<any>>(targetClass: T): any {
    const key = targetClass.name as keyof BaseAppConfig;
    return BaseConfig.config.config[key];
  }

  public async setup(): Promise<void> {
    let env: string;
    try {
      env = BaseDi.resolve<string>("env");
    } catch {
      // Default to 'default' environment if not registered
      env = 'default';
    }
    BaseConfig.config = BaseDi.resolve(BaseConfigRegistry, env);
  }
}
