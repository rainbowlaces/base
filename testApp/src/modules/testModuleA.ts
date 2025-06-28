import { type BaseActionArgs, baseModule, BaseModule, type BasePubSubArgs, type BaseTemplates, dependsOn, di, init, request, sub } from "../../../src";

@baseModule
export class TestModuleA extends BaseModule {
  @di("BaseTemplates")
  private accessor _templates!: BaseTemplates;

  @init()
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async init() {}

  @request({ phase: 1 })
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

  // Test same-module dependency
  @init({ phase: 1 })  // Put this in phase 1
  @dependsOn("init") // Same-module dependency - clean and simple!
  async anotherInitMethod() {
    this.logger.info("Another init method called");
  }
}
