import { BaseDi } from "../../di/baseDi.js";
import { BasePubSub } from "../../pubsub/basePubSub.js";
import { type BasePubSubArgs } from "../../pubsub/types.js";
import { BaseContext } from "../../module/baseContext.js";
import { type BaseModule } from "../../module/baseModule.js";
import { type BaseAction, type ActionOptions } from "../../module/types.js";
import { type BaseWebSocketActionArgs } from "../websocketContext.js";

function message(optionsOrTopic?: ActionOptions | string) {
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

    // WebSocket handlers are not middleware by default
    target.phase = options.phase ?? 100;
    target.middleware = options.middleware ?? false;

    context.addInitializer(function () {
      const module = this as BaseModule;
      const moduleName = module.constructor.name;
      const actionName = target.name;
      target.module = moduleName;
      
      // WebSocket message topic pattern: /websocket/message{path}
      target.topic = `/websocket/message${options.topic ?? "/*"}`;

      BaseContext.registerAction(target.topic, target);

      const pubsub = BaseDi.resolve(BasePubSub);

      pubsub.sub(
        `/context/execute/${moduleName}/${actionName}`,
        async function (args: BasePubSubArgs) {
          if (!args.context) return;
          await module.executeAction(target.name, args as BaseWebSocketActionArgs);
        }
      );
    });
  };
}

export { message, message as websocket };
