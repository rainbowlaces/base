import { type BaseAppConfig, BaseConfigProvider, provider, LogLevel } from "../../../src/index.js";

@provider()
export class AppConfig extends BaseConfigProvider {
  get config(): Partial<BaseAppConfig> {
    return {
      BaseRouter: {
        defaultRoute: "/dashboard"
      },
      BaseLogger: {
        logLevel: LogLevel.DEBUG
      }
    };
  }
  
}