import dependsOn from "../../../decorators/dependsOn";
import BaseModule from "../../../core/baseModule";
import init from "../../../decorators/actions/init";
import request from "../../../decorators/actions/request";
import { BaseActionArgs } from "../../../core/baseAction";
import BaseTemplates from "../../../modules/templates";
import di from "../../../decorators/di";
import global from "../../../decorators/actions/global";
import { delay } from "../../../utils/async";

export default class TestModuleA extends BaseModule {
  @di("BaseTemplates")
  private _templates!: BaseTemplates;

  @init()
  @dependsOn("TestModuleB/init")
  async init() {}

  @global()
  @request()
  async handleTestAction1(args?: BaseActionArgs) {
    await delay(1000);
    this.logger.info("Handling test action1");
    const ctx = args?.context;
    if (!ctx) return;
  }
}
