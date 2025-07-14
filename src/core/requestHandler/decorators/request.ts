import { BaseDi } from "../../di/baseDi.js";
import { type BasePubSub } from "../../pubsub/basePubSub.js";
import { type BasePubSubArgs } from "../../pubsub/types.js";
import { BaseContext } from "../../module/baseContext.js";
import { type BaseModule } from "../../module/baseModule.js";
import { type BaseAction, type ActionOptions } from "../../module/types.js";
import { type BaseHttpActionArgs } from "../types.js";

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

      // Execution subscription - handle the actual HTTP action execution
      pubsub.sub(
        `/context/execute/${moduleName}/${actionName}`,
        async function (args: BasePubSubArgs) {
          if (!args.context) return;
          // HTTP actions should receive BaseHttpActionArgs, but executeAction expects BaseActionArgs
          // Since BaseHttpActionArgs extends BaseActionArgs, this should be safe
          await module.executeAction(target.name, args as BaseHttpActionArgs);
        }
      );
    });
  };
}

export { request };
