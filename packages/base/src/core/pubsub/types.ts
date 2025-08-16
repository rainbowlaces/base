export interface BasePubSubArgs {
  topic: string;
  [key: string]: unknown;
}

export type MatchedTopics = Map<string, BasePubSubArgs>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Subscriber = (args: BasePubSubArgs) => Promise<any> | Promise<void>;

export interface Subscription {
  topic: string;
  pattern: URLPattern;
  handler: Subscriber;
  once: boolean;
  matchedTopics: MatchedTopics;
}

export interface SubscriptionMatch {
  subscription: Subscription;
  match: boolean;
  params?: BasePubSubArgs;
}