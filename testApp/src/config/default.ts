import { type BaseAppConfig, BaseConfigProvider, provider } from "../../../src";

@provider()
export class AppConfig extends BaseConfigProvider {
  get config(): Partial<BaseAppConfig> {
    return {
      // PingModule: {
      //   pingMessage: "Hello world!",
      // },
    };
  }
  
}