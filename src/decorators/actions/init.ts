import { type BaseModule } from "../../core/baseModule";
import { BasePubSub, type BasePubSubArgs } from "../../core/pubsub/basePubSub";
import { type BaseAction, type BaseActionArgs, type ActionOptions } from "../../core/baseAction";

export function init(options: Omit<ActionOptions, "topic"> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (t: (...args: any[]) => any, context: ClassMethodDecoratorContext): void => {
    const target = t as BaseAction;
    target.action = true;
    target.type = "init";
    target.phase = options.phase ?? 0;

    context.addInitializer(function () {
      const module = this as BaseModule;
      const moduleName = module.constructor.name;
      const actionName = target.name;

      // RFA subscription - respond to Request for Action
      BasePubSub.sub(
        `/context/init/:contextId/rfa`,
        async function (args: BasePubSubArgs) {
          const rfaPayload = (args as unknown) as { contextId: string; contextType: string };
          // Respond with Intent to Handle (ITH)
          const ithTopic = `/context/${rfaPayload.contextId}/ith`;
          void BasePubSub.create().pub(ithTopic, {
            module: moduleName,
            action: actionName,
            phase: target.phase
          });
        }
      );

      // Execution subscription - handle the actual action execution
      BasePubSub.sub(
        `/context/execute/${moduleName}/${actionName}`,
        async function (args: BasePubSubArgs) {
          if (!args.context) return;
          await module.executeAction(target.name, args as BaseActionArgs);
        }
      );
    });
  };
}
