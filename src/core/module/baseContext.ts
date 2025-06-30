import { nanoid } from "nanoid";
import { EventEmitter } from "events";
import { BasePubSub } from "../pubsub/basePubSub";
import { BaseDi, di } from "../di/baseDi";
import { type ContextState, type ModuleStatusArgs, type TopicFunction } from "./types";
import { type BasePubSubArgs, type Subscription } from "../pubsub/types";
import { type BaseModule } from "./baseModule";

export abstract class BaseContext<
  T = Record<string, unknown>,
> extends EventEmitter {
  #id: string;
  #created: number = Date.now();
  #actionLog: Set<string> = new Set<string>();
  #topicFunction: TopicFunction;

  @di<BasePubSub>(BasePubSub)
  private static accessor pubsub: BasePubSub;

  #data: T = {} as T;

  #state: ContextState = "pending";

  // RFA (Request for Action) properties
  #phaseMap = new Map<number, Set<string>>();
  #rfaSubscription?: Subscription;

  static #registry: FinalizationRegistry<Subscription> =
    new FinalizationRegistry<Subscription>((sub: Subscription) => {
      BaseContext.pubsub.unsub(sub);
    });

  constructor(topicFunction: TopicFunction) {
    super();
    this.#id = nanoid();
    this.#topicFunction = topicFunction;

    const sub = BaseContext.pubsub.sub(
      topicFunction(this.#id, ":module", ":action", ":status"),
      async (args: BasePubSubArgs) => {
        const modArgs = args as ModuleStatusArgs;
        const dep = `${modArgs.module}/${modArgs.action}`;
        if (modArgs.status === "error") {
          this.error();
          return this.emit("dependencyError", dep);
        }
        this.#actionLog.add(dep);
        this.start();
        return this.emit("dependencyDone", dep);
      }
    );
    BaseContext.#registry.register(this, sub);
  }

  // Abstract method for context type detection (RFA topic generation)
  protected abstract getContextType(): string;

  // RFA/ITH coordination flow
  protected async _coordinateAndRun(): Promise<void> {
    const contextType = this.getContextType();
    const rfaTopic = `/context/${contextType}/${this.#id}/rfa`;
    const ithTopic = `/context/${this.#id}/ith`;

    // Set up ITH response listener
    this.#rfaSubscription = BaseContext.pubsub.sub(
      ithTopic,
      async (args: BasePubSubArgs) => {
        const payload = args as unknown as {
          module: string;
          action: string;
          phase: number;
        };
        const actionId = `${payload.module}/${payload.action}`;

        if (!this.#phaseMap.has(payload.phase)) {
          this.#phaseMap.set(payload.phase, new Set());
        }
        const phaseActions = this.#phaseMap.get(payload.phase);
        if (phaseActions) {
          phaseActions.add(actionId);
        }
      }
    );

    // Publish RFA
    void BaseContext.pubsub.pub(rfaTopic, {
      contextId: this.#id,
      contextType,
    });

    // Wait for ITH responses with timeout
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        // Cleanup subscription
        if (this.#rfaSubscription) {
          BaseContext.pubsub.unsub(this.#rfaSubscription);
          this.#rfaSubscription = undefined;
        }
        resolve();
      }, 50);
    });

    // Fast-fail validation
    if (this.#phaseMap.size === 0) {
      const error = new Error(
        `No handlers were found for ${contextType} context`
      );
      this.error();
      throw error;
    }

    // Validate phase dependencies before execution
    this._validatePhases();

    // Run phases
    await this._runPhases();
  }

  // Sequential phase execution
  private async _runPhases(): Promise<void> {
    const sortedPhases = Array.from(this.#phaseMap.keys()).sort(
      (a, b) => a - b
    );

    for (const phase of sortedPhases) {
      const actionsInPhase = this.#phaseMap.get(phase) ?? new Set();

      // Execute all actions in this phase
      const phasePromises = Array.from(actionsInPhase).map((actionId) => {
        const [module, action] = actionId.split("/");
        const executionTopic = `/context/execute/${module}/${action}`;

        return new Promise<void>((resolve) => {
          // Wait for this specific action to complete
          const completionHandler = (dep: string) => {
            if (dep === actionId) {
              this.off("dependencyDone", completionHandler);
              resolve();
            }
          };
          this.on("dependencyDone", completionHandler);

          // Trigger the action execution
          void BaseContext.pubsub.pub(executionTopic, { context: this });
        });
      });

      // Wait for all actions in this phase to complete
      await Promise.all(phasePromises);

      // Check for errors
      if (this.#state === "error") {
        return;
      }
    }

    this.done();
  }

  // Validate phase dependencies to prevent paradoxes
  private _validatePhases(): void {
    // Build a map of action to phase for quick lookup
    const actionToPhaseMap = new Map<string, number>();
    for (const [phase, actions] of this.#phaseMap.entries()) {
      for (const actionId of actions) {
        actionToPhaseMap.set(actionId, phase);
      }
    }

    // Check each action's dependencies
    for (const [phase, actions] of this.#phaseMap.entries()) {
      for (const actionId of actions) {
        const [moduleName, actionName] = actionId.split("/");

        try {
          // Resolve the module instance to get action metadata
          const module = BaseDi.resolve<BaseModule>(moduleName);

          // Get the action from the module
          const action = module.getAction(actionName);
          if (!action?.dependsOn) {
            continue; // No dependencies to validate
          }

          // Check each dependency
          for (const depId of action.dependsOn) {
            const depPhase = actionToPhaseMap.get(depId);

            if (depPhase === undefined) {
              // Dependency not found in current execution plan
              throw new Error(
                `Dependency Resolution Error: Action '${actionId}' (Phase ${phase}) ` +
                  `depends on '${depId}' which is not scheduled for execution in this context.`
              );
            }

            // Check for phase paradox
            if (depPhase > phase) {
              throw new Error(
                `Phase Dependency Paradox: Action '${actionId}' (Phase ${phase}) ` +
                  `depends on '${depId}' (Phase ${depPhase}). ` +
                  `Dependencies must be in the same phase or an earlier phase.`
              );
            }
          }
        } catch (error) {
          // Re-throw with context
          if (error instanceof Error) {
            throw new Error(`Phase validation failed: ${error.message}`);
          }
          throw error;
        }
      }
    }
  }

  actionDone(module: string, action: string) {
    void BaseContext.pubsub.pub(
      this.#topicFunction(this.#id, module, action, "done")
    );
  }

  actionError(module: string, action: string) {
    void BaseContext.pubsub.pub(
      this.#topicFunction(this.#id, module, action, "error")
    );
  }

  get id(): string {
    return this.#id;
  }

  get age(): number {
    return Date.now() - this.#created;
  }

  get created(): number {
    return this.#created;
  }

  get state(): ContextState {
    return this.#state;
  }

  get data(): T {
    return this.#data;
  }

  done() {
    if (this.#state === "error") return;
    this.#state = "done";
  }

  error() {
    if (this.#state === "done") return;
    this.#state = "error";
  }

  start() {
    if (this.#state === "done") return;
    if (this.#state === "error") return;
    this.#state = "running";
  }

  private matchDependencies(dependencies: string[]): boolean {
    return dependencies.every((dep) => this.#actionLog.has(dep));
  }

  public async waitFor(dependencies: string[]): Promise<void> {
    if (this.matchDependencies(dependencies)) return;

    function depHandler(
      this: BaseContext<T>,
      resolve: () => void,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: any
    ) {
      if (this.matchDependencies(dependencies)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
        reject(new Error(`Dependencies not met: ${dependencies.join(", ")}`));
      });
    });
  }
}
