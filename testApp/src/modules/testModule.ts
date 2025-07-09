import { type BaseClassConfig } from "../../../src/core/config/types";
import { BaseModule } from "../../../src/core/module/baseModule";
import { baseModule } from "../../../src/core/module/decorators/baseModule";
import { request } from "../../../src/core/module/decorators/request";
import { type BaseHttpActionArgs } from "../../../src/core/module/types";

export interface PingModuleConfig extends BaseClassConfig {
  pingMessage: string;
}

@baseModule
export class PingModule extends BaseModule<PingModuleConfig> {
  
  @request("/get/ping")
  async handlePing(args: BaseHttpActionArgs) {
    const ctx = args.context;
    
    this.logger.info("Ping request received", [ctx.id]);
    
    // Send PONG response
    await ctx.res.text(`PONG! ${this.config.pingMessage}`);
    
    this.logger.debug("Ping response sent", [ctx.id]);
  }
}

// Declaration merging to add the ping config to the global app config type
declare module "../../../src/core/config/types" {
  interface BaseAppConfig {
    PingModule?: PingModuleConfig;
  }
}