import { BaseDi } from "../../di/baseDi";
import { type BasePubSub } from "../../pubsub/basePubSub";
import { type BasePubSubArgs } from "../../pubsub/types";
import { BaseContext } from "../baseContext";
import { type BaseModule } from "../baseModule";
import { type BaseAction, type ActionOptions, type BaseActionArgs } from "../types";

function request(optionsOrTopic?: ActionOptions | string) {
  return function (
    this: unknown,
    t: unknown,
    context: ClassMethodDecoratorContext,
  ): void {
    const target = t as BaseAction;
    target.action = true;

    // Handle both string topic and ActionOptions
    let options: ActionOptions;
    if (typeof optionsOrTopic === "string") {
      options = { topic: optionsOrTopic, phase: 100 };
    } else {
      options = optionsOrTopic ?? {};
    }
    
    target.phase = options.phase ?? 1;

    context.addInitializer(function () {
      const module = this as BaseModule;
      const moduleName = module.constructor.name;
      const actionName = target.name;
      target.module = moduleName;
      target.topic = `/request/:requestId${options.topic ?? "/*"}`;

      BaseContext.registerAction(target.topic, target);

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

export { request };
