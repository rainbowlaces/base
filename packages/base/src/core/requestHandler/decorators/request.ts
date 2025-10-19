import { BaseDi } from "../../di/baseDi.js";
import { BasePubSub } from "../../pubsub/basePubSub.js";
import { type BasePubSubArgs } from "../../pubsub/types.js";
import { BaseContext } from "../../module/baseContext.js";
import { type BaseModule } from "../../module/baseModule.js";
import { type BaseAction, type ActionOptions } from "../../module/types.js";
import { BaseError } from "../../baseErrors.js";
import { setActionMetadata } from "../metadata.js";
import { type BaseHttpActionArgs } from "../types.js";

/**
 * Request decorator. Use manual type intersections for route params.
 * 
 * @example
 * @request("/users/:id")
 * async getUser({ context, id }: BaseHttpActionArgs & { id: string }) {
 *   const user = await this.userService.findById(id);
 * }
 */
function request(optionsOrTopic?: ActionOptions | string) {
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

    // Default middleware to true if no topic is specified (i.e., it's a global handler)
    if (options.topic === undefined) {
      options.middleware = options.middleware ?? true;
    }
    
  if (options.phase !== undefined && options.phase < 50 && !options._internal) {
      throw new BaseError(`Request action phase must be >= 50 (reserved <50 for internal actions). Received: ${options.phase}.`);
    }
    target.phase = options.phase ?? 100;
    target.middleware = options.middleware ?? false; // Default to false if not specified
  if (options.timeout !== undefined) setActionMetadata(target, { timeout: options.timeout });

    context.addInitializer(function () {
      const module = this as BaseModule;
      const moduleName = module.constructor.name;
      const actionName = target.name;
      target.module = moduleName;
      target.topic = `/request/:requestId${options.topic ?? "/*"}`;

      BaseContext.registerAction(target.topic, target);

      const pubsub = BaseDi.resolve(BasePubSub);

      pubsub.sub(
        `/context/execute/${moduleName}/${actionName}`,
        async function (args: BasePubSubArgs) {
          if (!args.context) return;
          await module.executeAction(target.name, args as BaseHttpActionArgs);
        }
      );
    });
  };
}

export { request };