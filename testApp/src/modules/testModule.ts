import { type BaseClassConfig } from "../../../src/core/config/types";
import { BaseModule } from "../../../src/core/module/baseModule";
import { baseModule } from "../../../src/core/module/decorators/baseModule";
import { request } from "../../../src/core/module/decorators/request";
import { type BaseHttpActionArgs } from "../../../src/core/module/types";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PingModuleConfig implements BaseClassConfig {
}

@baseModule
export class PingModule extends BaseModule {
  
  @request("/get/ping")
  async handlePing(args: BaseHttpActionArgs) {
    const ctx = args.context;
    
    this.logger.info("Ping request received", [ctx.id]);
    
    // Send PONG response
    await ctx.res.text("PONG");
    
    this.logger.debug("Ping response sent", [ctx.id]);
  }
}

// Declaration merging to add the ping config to the global app config type
declare module "../../../src/core/config/types" {
  interface BaseAppConfig {
    PingModule?: PingModuleConfig;
  }
}