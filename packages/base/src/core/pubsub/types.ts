export interface BasePubSubArgs {
  topic: string;
  [key: string]: unknown;
}

export type MatchedTopics = Map<string, BasePubSubArgs>;

/**
 * A function that handles pubsub messages.
 * Can be generic to accept typed arguments with route parameters.
 * 
 * @example
 * const handler: Subscriber<BasePubSubArgs & { id: string }> = async ({ topic, id }) => {
 *   console.log(topic, id);
 * };
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Subscriber<T extends BasePubSubArgs = BasePubSubArgs> = (args: T) => Promise<any> | Promise<void>;

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