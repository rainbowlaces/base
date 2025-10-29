import { BaseDi } from "../../di/baseDi.js";
import { BasePubSub } from "../../pubsub/basePubSub.js";
import { type BasePubSubArgs } from "../../pubsub/types.js";
import { BaseContext } from "../../module/baseContext.js";
import { type BaseModule } from "../../module/baseModule.js";
import { type BaseAction, type ActionOptions } from "../../module/types.js";
import { type BaseWebSocketCloseArgs } from "../types.js";

/**
 * @close decorator for handling WebSocket disconnection/close events
 * This is called when a WebSocket connection is closed
 * Uses URLPattern for path matching and parameter extraction (handled by BaseContext)
 */
function close(optionsOrTopic?: ActionOptions | string) {
  return function (
    this: unknown,
    t: unknown,
    context: ClassMethodDecoratorContext,
  ): void {
    const target = t as BaseAction;
    target.action = true;

    let options: ActionOptions;
    if (typeof optionsOrTopic === "string") {
      options = { topic: optionsOrTopic };
    } else {
      options = optionsOrTopic ?? {};
    }

    target.phase = options.phase ?? 100;
    target.middleware = false; // Close handlers are not middleware

    context.addInitializer(function () {
      const module = this as BaseModule;
      const moduleName = module.constructor.name;
      const actionName = target.name;
      target.module = moduleName;
      target.topic = `/websocket/close${options.topic ?? "/*"}`;

      BaseContext.registerAction(target.topic, target);

      const pubsub = BaseDi.resolve(BasePubSub);

      pubsub.sub(
        `/context/execute/${moduleName}/${actionName}`,
        async function (args: BasePubSubArgs) {
          if (!args.context) return;
          
          // BaseContext already extracted URL params and spread them into args
          await module.executeAction(target.name, args as BaseWebSocketCloseArgs);
        }
      );
    });
  };
}

export { close };
