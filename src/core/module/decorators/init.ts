import { BaseDi } from "../../di/baseDi.js";
import { type BasePubSub } from "../../pubsub/basePubSub.js";
import { type BasePubSubArgs } from "../../pubsub/types.js";
import { BaseContext } from "../baseContext.js";
import { type BaseModule } from "../baseModule.js";
import { type ActionOptions, type BaseAction, type BaseActionArgs } from "../types.js";


export function init(options: Omit<ActionOptions, "topic"> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (t: (...args: any[]) => any, context: ClassMethodDecoratorContext): void => {
    const target = t as BaseAction;
    target.action = true;
    target.phase = options.phase ?? 100;

    context.addInitializer(function () {
      const module = this as BaseModule;
      const moduleName = module.constructor.name;
      const actionName = target.name;
      target.module = moduleName;

      BaseContext.registerAction('/init', target);

      const pubsub = BaseDi.resolve<BasePubSub>("BasePubSub");

      // Execution subscription - handle the actual action execution
      pubsub.sub(
        `/context/execute/${moduleName}/${actionName}`,
        async function (args: BasePubSubArgs) {
          if (!args.context) return;
          await module.executeAction(target.name, args as BaseActionArgs);
        }
      );
    });
  };
}
