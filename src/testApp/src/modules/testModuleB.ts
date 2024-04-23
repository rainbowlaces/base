import init from "../../../decorators/actions/init";
import BaseModule from "../../../core/baseModule";
import { delay } from "../../../utils/async";
import request from "../../../decorators/actions/request";
import { BaseActionArgs } from "../../../core/baseAction";
import BaseTemplates from "../../../modules/templates";
import di from "../../../decorators/di";
import { BaseHttpContext } from "../../../core/requestHandler/httpContext";

export default class TestModuleB extends BaseModule {
  @di<BaseTemplates>("BaseTemplates")
  private _templates!: BaseTemplates;

  @init()
  async init() {
    await delay(1000);
  }

  @request("/get/bing/bang")
  async handleTestAction(args?: BaseActionArgs) {
    this.logger.info("Handling test bang action");
    await delay(1000);
    const ctx = args?.context as unknown as BaseHttpContext;
    ctx.res.html(this._templates.render("index"));
  }
}
