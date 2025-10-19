import { BasePubSub } from "../basePubSub.js";
import { type Subscriber } from "../types.js";
import { BaseDi } from "../../di/baseDi.js";

/**
 * Subscribe to a pubsub topic. Use manual type intersections for route params.
 * 
 * @example
 * @sub("user/:id/updated")
 * async onUpdate({ topic, id }: BasePubSubArgs & { id: string }) {
 *   console.log(`User ${id} updated`);
 * }
 */
export function sub(topic: string) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    target: Subscriber<any>, 
    context: ClassMethodDecoratorContext
  ): void => {
    context.addInitializer(function (this: unknown) {
      const pubsub = BaseDi.resolve(BasePubSub);
      pubsub.sub(topic, target.bind(this));
    });
  };
}
