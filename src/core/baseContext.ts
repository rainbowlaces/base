import { nanoid } from "nanoid";
import EventEmitter from "events";
import { BasePubSub, BasePubSubArgs, Subscription } from "./basePubSub";

type TopicFunction = (
  id: string,
  module: string,
  action: string,
  status: string,
) => string;

type ContextState = "pending" | "running" | "done" | "error";

interface ModuleStatusArgs extends BasePubSubArgs {
  module: string;
  action: string;
  status: "error" | "done";
}

export abstract class BaseContext<
  T = Record<string, unknown>,
> extends EventEmitter {
  private _id: string;
  private _created: number = Date.now();
  private _actionLog: Set<string> = new Set<string>();
  private _topicFunction: TopicFunction;

  private _data: T = {} as T;

  private _state: ContextState = "pending";

  static _registry: FinalizationRegistry<Subscription> =
    new FinalizationRegistry<Subscription>((sub: Subscription) =>
      BasePubSub.unsub(sub),
    );

  constructor(topicFunction: TopicFunction) {
    super();
    this._id = nanoid();
    this._topicFunction = topicFunction;

    const sub = BasePubSub.sub(
      topicFunction(this._id, ":module", ":action", ":status"),
      async (args: BasePubSubArgs) => {
        const modArgs = args as ModuleStatusArgs;
        const dep = `${modArgs.module}/${modArgs.action}`;
        if (modArgs.status === "error") {
          this.error();
          return this.emit("dependencyError", dep);
        }
        this._actionLog.add(dep);
        this.start();
        return this.emit("dependencyDone", dep);
      },
    );
    BaseContext._registry.register(this, sub);
  }

  actionDone(module: string, action: string) {
    BasePubSub.create().pub(
      this._topicFunction(this._id, module, action, "done"),
    );
  }

  actionError(module: string, action: string) {
    BasePubSub.create().pub(
      this._topicFunction(this._id, module, action, "error"),
    );
  }

  get id(): string {
    return this._id;
  }

  get age(): number {
    return Date.now() - this._created;
  }

  get created(): number {
    return this._created;
  }

  get state(): ContextState {
    return this._state;
  }

  get data(): T {
    return this._data;
  }

  done() {
    if (this._state === "error") return;
    this._state = "done";
  }

  error() {
    if (this._state === "done") return;
    this._state = "error";
  }

  start() {
    if (this._state === "done") return;
    if (this._state === "error") return;
    this._state = "running";
  }

  private matchDependencies(dependencies: string[]): boolean {
    return dependencies.every((dep) => this._actionLog.has(dep));
  }

  public async waitFor(dependencies: string[]): Promise<void> {
    if (this.matchDependencies(dependencies)) return;

    function depHandler(
      this: BaseContext<T>,
      resolve: () => void,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: any,
    ) {
      if (this.matchDependencies(dependencies)) {
        this.off("dependencyDone", handler);
        resolve();
      }
    }

    return new Promise((resolve, reject) => {
      const handler = depHandler.bind(this, resolve);
      this.on("dependencyDone", () => {
        handler.apply(this, [handler]);
      });
      this.on("dependencyError", () => {
        reject();
      });
    });
  }
}
