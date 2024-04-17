import { EventEmitter } from "events";
import BasePubSub, { BasePubSubArgs, Subscription } from "./basePubSub";
import { match } from "path-to-regexp";

export class BaseReadyCheck extends EventEmitter {
  private _dependencies: Set<string>;
  private _ready: Set<string>;
  private _isReady: boolean = false;

  constructor(dependencies: string[]) {
    super();
    this._dependencies = new Set(dependencies);
    this._ready = new Set();
    this._isReady = !this._dependencies.size;
  }

  done(dep: string) {
    this.ready(dep);
  }

  ready(dep: string) {
    if (!this._dependencies.has(dep)) return;
    this._ready.add(dep);
    if (this._ready.size === this._dependencies.size) {
      this._isReady = true;
      this.emit("ready");
    }
  }

  async isReady(): Promise<void> {
    if (this._isReady) {
      return;
    }
    return new Promise((resolve) => {
      this.once("ready", () => {
        resolve();
      });
    });
  }
}

export class BaseTopicCheck extends BaseReadyCheck {
  private _deps!: BaseReadyCheck;
  private _topic: (dep: string) => string;
  static _registry: FinalizationRegistry<Subscription> =
    new FinalizationRegistry<Subscription>((sub: Subscription) =>
      BasePubSub.unsub(sub),
    );

  constructor(
    deps: string[],
    topic: (dep: string) => string,
    map: (args: BasePubSubArgs) => string = (args) => args.dep,
  ) {
    super(deps);
    this._topic = topic;
    const sub = BasePubSub.sub(
      this._topic(":dep"),
      async (args: BasePubSubArgs = {}) => {
        const dep = map(args);
        this.ready(dep);
      },
    );
    BaseTopicCheck._registry.register(this, sub);
  }

  done(dep: string) {
    BasePubSub.create().pub(this._topic(dep));
  }
}

export class BaseTopicLogger extends EventEmitter {
  private _topics: Set<string> = new Set<string>();
  static _registry: FinalizationRegistry<Subscription> =
    new FinalizationRegistry<Subscription>((sub: Subscription) =>
      BasePubSub.unsub(sub),
    );
  constructor(topic: string) {
    super();
    const sub = BasePubSub.sub(topic, async (args: BasePubSubArgs = {}) => {
      this._topics.add(args.__topic);
      console.log(`Seen: ${args.__topic}`);
      this.emit("topic", args.__topic);
    });
    BaseTopicCheck._registry.register(this, sub);
  }

  has(topic: string): boolean {
    return this._topics.has(topic);
  }

  private matchTopics(topics: string[]): boolean {
    const matches = topics.map((topic) => match(topic));
    return matches.every((match) => Array.from(this._topics).some(match));
  }

  async waitFor(topics: string[]): Promise<void> {
    if (this.matchTopics(topics)) return;

    function topicHandler(
      this: BaseTopicLogger,
      resolve: () => void,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: any,
    ) {
      if (this.matchTopics(topics)) {
        this.off("topic", handler);
        resolve();
      }
    }

    return new Promise((resolve) => {
      const handler = topicHandler.bind(this, resolve);
      this.on("topic", handler.bind(this, handler));
    });
  }
}
