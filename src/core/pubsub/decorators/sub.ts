import { BasePubSub } from "../basePubSub";
import { type Subscriber } from "../types";

export function sub(topic: string) {
  return (target: Subscriber, context: ClassMethodDecoratorContext): void => {
    context.addInitializer(function () {
      // 'this' here refers to the class instance when the initializer runs
      BasePubSub.sub(topic, target.bind(this));
    });
  };
}
