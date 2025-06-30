import { delay } from "../../utils/async";
import { BaseError } from "../baseErrors";
import { di } from "../di/baseDi";
import { registerDi } from "../di/decorators/registerDi";
import { BaseLogger } from "../logger/baseLogger";
import { type BasePubSubArgs, type Subscriber, type Subscription, type SubscriptionMatch } from "./types";

@registerDi({ singleton: true, teardown: true })
export class BasePubSub {
  private static instance?: BasePubSub;

  private subscriptions: Set<Subscription> = new Set<Subscription>();
  private inflightCount = 0;

  @di<BaseLogger>(BaseLogger, "PubSub")
  private accessor logger!: BaseLogger;

  get inFlight(): number {
    return this.inflightCount;
  }

  async pub(topic: string, args?: Partial<BasePubSubArgs>): Promise<void> {
    this.inflightCount += 1;
    await delay();
    await Promise.all(
      this.filterSubs(topic).map(async (m: SubscriptionMatch) => {
        const fullArgs = { ...args, ...(m.params ?? {}), topic };
        m.subscription
          .handler(fullArgs)
          .catch(this.handleError.bind(this));
        if (m.subscription.once)
          this.subscriptions.delete(m.subscription);
      }),
    );
    this.inflightCount -= 1;
  }

  unsub(topic: string | Subscription): void {
    if (typeof topic === "string") {
      this.filterSubs(topic).forEach((m: SubscriptionMatch) => {
        this.subscriptions.delete(m.subscription);
      });
      return;
    }
    this.subscriptions.delete(topic);
  }

  async once(topic: string) {
    return new Promise<void>((resolve) => {
      this.sub(topic, async () => { resolve(); }, true);
    });
  }

  private createURLPattern(topic: string): URLPattern {
    try {
      return new URLPattern({ pathname: topic });
    } catch (err) {
       
      throw new Error(`Invalid topic pattern: ${topic}.`, err as Error);
    }
  }

  sub(
    topic: string,
    handler: Subscriber,
    once = false,
  ): Subscription {
    const subscription: Subscription = {
      topic,
      handler,
      pattern: this.createURLPattern(topic),
      once,
      matchedTopics: new Map<string, BasePubSubArgs>(),
    };
    this.subscriptions.add(subscription);
    return subscription;
  }

  private filterSubs(topic: string): SubscriptionMatch[] {
    return Array.from(this.subscriptions)
      .map((subscription: Subscription): SubscriptionMatch => {
        if (subscription.matchedTopics.has(topic)) {
          return {
            subscription,
            match: true,
            params: subscription.matchedTopics.get(topic),
          };
        }
        const match = subscription.pattern.exec({ pathname: topic });
        return {
          subscription,
          match: !!match,
           
          params: match ? (match.pathname.groups as BasePubSubArgs) : undefined,
        };
      })
      .filter((m: SubscriptionMatch) => !!m.match);
  }

  async teardown(): Promise<void> {
    this.logger.info("BasePubSub teardown started.");
    this.subscriptions.clear();
    this.logger.info('BasePubSub teardown complete.');
  }

  private handleError(error: Error): void {
    this.logger.error("Error in pubsub handler:", [], { error: new BaseError(error.message, error) });
  }
}
