import BaseModule from "../../core/baseModule";
import BasePubSub, { BasePubSubArgs } from "../../core/basePubSub";
import { BaseAction, BaseActionArgs } from "../../core/baseAction";

export default function init() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (t: (...args: any[]) => any, context: ClassMethodDecoratorContext): void => {
    if (context.kind !== "method") return;

    const target = t as BaseAction;
    target.action = true;
    target.type = "init";
    target.isGlobal = false;

    context.addInitializer(function () {
      BasePubSub.sub(
        `/base/init`,
        async function (this: BaseModule, args: BasePubSubArgs) {
          if (!args.context) return;
          await this.executeAction(target.name, args as BaseActionArgs);
        }.bind(this as BaseModule),
      );
    });
  };
}
