import { type BaseAppConfig, BaseConfigProvider, provider } from "../../../src/index.js";

@provider()
export class AppConfig extends BaseConfigProvider {
  get config(): Partial<BaseAppConfig> {
    return {
      BaseRouter: {
        defaultRoute: "/dashboard"
      }
    };
  }
  
}