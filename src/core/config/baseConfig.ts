import { type BaseAppConfig } from "./types";
import { registerDi } from "../di/decorators/registerDi";
import { BaseConfigRegistry } from "./baseConfigRegistry";
import { BaseDi } from "../di/baseDi";
import { type Constructor } from "../di/types";

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
