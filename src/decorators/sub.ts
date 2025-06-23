import { BasePubSub, Subscriber } from "../core/basePubSub";

export function sub(this: object, topic: string) {
  return (target: Subscriber, context: ClassMethodDecoratorContext): void => {
    if (context.kind !== "method") return;
    context.addInitializer(function () {
      BasePubSub.sub(topic, target.bind(this));
    });
  };
}
