import dependsOn from "../../../decorators/dependsOn";
import BaseModule from "../../../core/baseModule";
import init from "../../../decorators/init";
import action from "../../../decorators/action";
import { BaseActionArgs } from "../../../core/baseAction";
import BaseTemplates from "../../../modules/templates";
import di from "../../../decorators/di";

@dependsOn("TestModuleB")
export default class TestModuleA extends BaseModule {
  @di("BaseTemplates")
  private _templates!: BaseTemplates;

  @init()
  async init() {}

  @action("/get/index")
  async handleTestAction1(args?: BaseActionArgs) {
    this.logger.info("Handling test action1");
    const ctx = args?.context;
    if (!ctx) return;
    ctx.res.send(this._templates.render("index"));
  }
}
