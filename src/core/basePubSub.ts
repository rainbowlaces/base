import { Match, MatchResult, match } from "path-to-regexp";
import { delay } from "../utils/async";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BasePubSubArgs = Record<string, any>;
type MatchedTopics = Map<string, BasePubSubArgs>;
export type Subscriber = (args: BasePubSubArgs) => Promise<void>;

export interface Subscription {
  topic: string;
  match: ReturnType<typeof match>;
  handler: Subscriber;
  once: boolean;
  matchedTopics: MatchedTopics;
}

interface SubscriptionMatch {
  subscription: Subscription;
  match: boolean;
  params?: BasePubSubArgs;
}

export default class BasePubSub {
  private static subscriptions: Set<Subscription> = new Set<Subscription>();
  private static _inflightCount: number = 0;

  static get inFlight(): number {
    return this._inflightCount;
  }

  constructor() {}

  static create(): BasePubSub {
    return new BasePubSub();
  }

  async pub(topic: string, args: BasePubSubArgs = {}): Promise<void> {
    BasePubSub._inflightCount += 1;
    await delay();
    await Promise.all(
      BasePubSub.filterSubs(topic).map(async (m: SubscriptionMatch) => {
        await delay();
        const fullArgs = { __topic: topic, ...args, ...(m.params || {}) };
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

  static sub(
    topic: string,
    handler: Subscriber,
    once: boolean = false,
  ): Subscription {
    const subscription: Subscription = {
      topic,
      handler,
      match: match(topic, { decode: decodeURIComponent }),
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
        const match: Match = subscription.match(topic);
        return {
          subscription,
          match: !!match,
          params: match
            ? ((match as MatchResult).params as BasePubSubArgs)
            : undefined,
        };
      })
      .filter((m: SubscriptionMatch) => !!m.match);
  }

  private static handleError(err: Error): void {
    console.error(err);
  }
}
