import init from "../../../decorators/init";
import BaseModule from "../../../core/baseModule";
import { delay } from "../../../utils/async";
import action from "../../../decorators/action";
import { BaseActionArgs } from "../../../core/baseAction";
import BaseContext from "../../../core/baseContext";

export default class TestModuleB extends BaseModule {
  @init()
  async init() {
    await delay(1000);
  }

  @action("/get/bing/bang")
  async handleTestAction(args?: BaseActionArgs) {
    this.logger.info("Handling test bang action");
    const ctx = args?.context as BaseContext;
    ctx.res.send("Hello, BANG!");
  }
}
