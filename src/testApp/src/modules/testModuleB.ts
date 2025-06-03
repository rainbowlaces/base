import init from "../../../decorators/actions/init";
import BaseModule from "../../../core/baseModule";
import request from "../../../decorators/actions/request";
import { BaseActionArgs } from "../../../core/baseAction";
import BaseTemplates from "../../../modules/templates";
import di from "../../../decorators/di";
import { BaseHttpContext } from "../../../core/requestHandler/httpContext";
import { TemplateData } from "../../../modules/templates/engine";

export default class TestModuleB extends BaseModule {
  @di<BaseTemplates>("BaseTemplates")
  private accessor _templates!: BaseTemplates;

  @init()
  async init() {}

  @request("/get/bing/bang")
  async handleTestAction(args?: BaseActionArgs) {
    this.logger.info("Handling test bang action");
    const ctx = args?.context as unknown as BaseHttpContext;

    ctx.data.message = ctx.req.url.searchParams.get("test"); // this should be sanitized by the template engine

    ctx.res.html(this._templates.render("index", ctx.data as TemplateData));
  }
}
