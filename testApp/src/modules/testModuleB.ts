import { type BaseActionArgs, type BaseHttpContext, baseModule, BaseModule, BasePubSub, type BaseTemplates, dependsOn, di, init, request } from "../../../src";
import { TestModuleA } from "./testModuleA";


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

  // Example of a valid phase dependency (commented out to keep system working)
  // @init({ phase: 1 })
  // @dependsOn("anotherInitMethod", TestModuleA)
  // async initAfterA() {
  //   this.logger.info("This runs after TestModuleA.anotherInitMethod");
  // }

  @request("/get/bing/bang/:id")
  async handleTestAction({ context: ctx }: BaseActionArgs & { context: BaseHttpContext }) {
    this.logger.info("Handling test bang action");

    ctx.data.email = ctx.req.url.searchParams.get("email");

    const pubsub = BasePubSub.create();
    const userId = ctx.req.url.pathname.split('/').pop();
    await pubsub.pub(`/user/${userId}/created`, { 
      userId, 
      email: ctx.data.email,
      source: "TestModuleB" 
    });

    void ctx.res.html(this._templates.render("index", ctx.data));
  }

  // This should trigger a phase paradox: Phase 0 depending on Phase 1 action
  @request({ phase: 0 })
  @dependsOn("handleTestAction1", TestModuleA)
  async handleParadoxAction(args?: BaseActionArgs) {
    this.logger.info("This should never run due to phase paradox");
    const ctx = args?.context;
    if (!ctx) return;
  }
}
