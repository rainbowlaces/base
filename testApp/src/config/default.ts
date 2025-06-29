import { type BaseAppConfig, BaseConfigProvider, config, LogLevel } from "../../../src";

@config()
export class AppConfig extends BaseConfigProvider {
  get config(): Partial<BaseAppConfig> {
    return {
      Base: {
        port: 3000,
      },
      BaseLogger: {
        logLevel: LogLevel.TRACE,
      }
    };
  }
  
}