import { delay } from "../utils/async";

export interface BasePubSubArgs {
  topic: string;
  [key: string]: unknown;
}

type MatchedTopics = Map<string, BasePubSubArgs>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Subscriber = (args: BasePubSubArgs) => Promise<any> | Promise<void>;

export interface Subscription {
  topic: string;
  pattern: URLPattern;
  handler: Subscriber;
  once: boolean;
  matchedTopics: MatchedTopics;
}

interface SubscriptionMatch {
  subscription: Subscription;
  match: boolean;
  params?: BasePubSubArgs;
}

export class BasePubSub {
  private static subscriptions: Set<Subscription> = new Set<Subscription>();
  private static _inflightCount = 0;

  static get inFlight(): number {
    return this._inflightCount;
  }

  static create(): BasePubSub {
    return new BasePubSub();
  }

  async pub(topic: string, args?: Partial<BasePubSubArgs>): Promise<void> {
    BasePubSub._inflightCount += 1;
    await delay();
    await Promise.all(
      BasePubSub.filterSubs(topic).map(async (m: SubscriptionMatch) => {
        await delay();
        const fullArgs = { ...args, ...(m.params || {}), topic };
        m.subscription
          .handler(fullArgs)
          .catch(BasePubSub.handleError.bind(this));
        if (m.subscription.once)
          BasePubSub.subscriptions.delete(m.subscription);
      }),
    );
    BasePubSub._inflightCount -= 1;
  }

  static unsub(topic: string | Subscription): void {
    if (typeof topic === "string") {
      BasePubSub.filterSubs(topic).forEach((m: SubscriptionMatch) => {
        BasePubSub.subscriptions.delete(m.subscription);
      });
      return;
    }
    BasePubSub.subscriptions.delete(topic);
  }

  static async once(topic: string) {
    return new Promise<void>((resolve) => {
      this.sub(topic, async () => resolve(), true);
    });
  }

  private static createURLPattern(topic: string): URLPattern {
    try {
      return new URLPattern({ pathname: topic });
    } catch (err) {
      throw new Error(`Invalid topic pattern: ${topic}. ${err}`);
    }
  }

  static sub(
    topic: string,
    handler: Subscriber,
    once = false,
  ): Subscription {
    const subscription: Subscription = {
      topic,
      handler,
      pattern: BasePubSub.createURLPattern(topic),
      once,
      matchedTopics: new Map<string, BasePubSubArgs>(),
    };
    this.subscriptions.add(subscription);
    return subscription;
  }

  private static filterSubs(topic: string): SubscriptionMatch[] {
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

  private static handleError(err: Error): void {
    console.error(err);
  }
}
