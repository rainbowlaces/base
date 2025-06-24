import { dependsOn } from "../../../decorators/dependsOn";
import { BaseModule } from "../../../core/baseModule";
import { init } from "../../../decorators/actions/init";
import { request } from "../../../decorators/actions/request";
import { BaseActionArgs } from "../../../core/baseAction";
import { BaseTemplates } from "../../../modules/templates";
import { di } from "../../../decorators/di";
import { global } from "../../../decorators/actions/global";
import { baseModule } from "../../../decorators/baseModule";
import { sub } from "../../../decorators/sub";
import { BasePubSubArgs } from "../../../core/basePubSub";

@baseModule
export class TestModuleA extends BaseModule {
  @di("BaseTemplates")
  private accessor _templates!: BaseTemplates;

  @init()
  @dependsOn("TestModuleB/init")
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async init() {}

  @global()
  @request()
  async handleTestAction1(args?: BaseActionArgs) {
    this.logger.info("Handling test action1");
    const ctx = args?.context;
    if (!ctx) return;
  }

  @sub("/test/module/event")
  async handleTestEvent(args: BasePubSubArgs) {
    this.logger.info("TestModuleA received event:", [JSON.stringify(args)]);
  }

  @sub("/user/*/created")
  async handleUserCreated(args: BasePubSubArgs) {
    this.logger.info("TestModuleA: User created event received:", [JSON.stringify(args)]);
  }
}
