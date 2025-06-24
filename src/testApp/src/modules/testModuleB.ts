import { init } from "../../../decorators/actions/init";
import { BaseModule } from "../../../core/baseModule";
import { request } from "../../../decorators/actions/request";
import { BaseActionArgs } from "../../../core/baseAction";
import { BaseTemplates } from "../../../modules/templates";
import { di } from "../../../decorators/di";
import { BaseHttpContext } from "../../../core/requestHandler/httpContext";
import { TemplateData } from "../../../modules/templates/engine";
import { baseModule } from "../../../decorators/baseModule";
import { BasePubSub } from "../../../core/basePubSub";

@baseModule
export class TestModuleB extends BaseModule {
  @di<BaseTemplates>("BaseTemplates")
  private accessor _templates!: BaseTemplates;

  @init()
  async init() {
    // Test publishing an event during initialization
    const pubsub = BasePubSub.create();
    await pubsub.pub("/test/module/event", { source: "TestModuleB", message: "Module initialized" });
  }

  @request("/get/bing/bang/:id")
  async handleTestAction(args?: BaseActionArgs) {
    this.logger.info("Handling test bang action");
    const ctx = args?.context as unknown as BaseHttpContext;

    ctx.data.email = ctx.req.url.searchParams.get("email");

    // Test publishing a user created event with URL parameter
    const pubsub = BasePubSub.create();
    const userId = ctx.req.url.pathname.split('/').pop();
    await pubsub.pub(`/user/${userId}/created`, { 
      userId, 
      email: ctx.data.email,
      source: "TestModuleB" 
    });

    ctx.res.html(this._templates.render("index", ctx.data as TemplateData));
  }
}
