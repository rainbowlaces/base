import { type BaseAppConfig, BaseConfigProvider, LogLevel, provider } from "../../../src";

@provider()
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