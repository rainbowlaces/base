import { BasePubSub } from "../basePubSub";
import { type Subscriber } from "../types";
import { BaseDi } from "../../di/baseDi";

export function sub(topic: string) {
  return (target: Subscriber, context: ClassMethodDecoratorContext): void => {
    context.addInitializer(function (this: unknown) {
      // 'this' here refers to the class instance when the initializer runs
      const pubsub = BaseDi.resolve<BasePubSub>(BasePubSub);
      pubsub.sub(topic, target.bind(this));
    });
  };
}
