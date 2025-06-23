import { BaseModule } from "../../core/baseModule";
import { BaseAction, BaseActionArgs } from "../../core/baseAction";
import { BasePubSub, BasePubSubArgs } from "../../core/basePubSub";

function request(topic?: string) {
  return function (
    this: unknown,
    t: unknown,
    context: ClassMethodDecoratorContext,
  ): void {
    if (context.kind !== "method") return;

    const target = t as BaseAction;

    target.action = true;
    target.type = "request";
    target.isGlobal = target.isGlobal ?? false;

    context.addInitializer(function () {
      BasePubSub.sub(
        `/request/:id${topic || "/:path*"}`,
        async function (this: BaseModule, args: BasePubSubArgs) {
          if (!args.context) return;
          await this.executeAction(target.name, args as BaseActionArgs);
        }.bind(this as BaseModule),
      );
    });
  };
}

export { request };
