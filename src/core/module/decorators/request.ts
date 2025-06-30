import { BaseDi } from "../../di/baseDi";
import { type BasePubSub } from "../../pubsub/basePubSub";
import { type BasePubSubArgs } from "../../pubsub/types";
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
    target.type = "request";

    // Handle backwards compatibility
    let options: ActionOptions;
    if (typeof optionsOrTopic === "string") {
      options = { topic: optionsOrTopic, phase: 1 };
    } else {
      options = optionsOrTopic ?? {};
    }
    
    target.phase = options.phase ?? 1;

    context.addInitializer(function () {
      const module = this as BaseModule;
      const moduleName = module.constructor.name;
      const actionName = target.name;

      const pubsub = BaseDi.resolve<BasePubSub>("BasePubSub");

      // RFA subscription - respond to Request for Action
      pubsub.sub(
        `/context/http/:contextId/rfa`,
        async function (args: BasePubSubArgs) {
          const rfaPayload = (args as unknown) as { contextId: string; contextType: string };
          // Respond with Intent to Handle (ITH)
          const ithTopic = `/context/${rfaPayload.contextId}/ith`;
          void pubsub.pub(ithTopic, {
            module: moduleName,
            action: actionName,
            phase: target.phase
          });
        }
      );

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
