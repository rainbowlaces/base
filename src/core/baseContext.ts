import { nanoid } from "nanoid";
import { EventEmitter } from "events";
import { BasePubSub, type BasePubSubArgs, type Subscription } from "./basePubSub";
import { BaseDi } from "./di/baseDi";
import { type BaseModule } from "./baseModule";

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
  
  // RFA (Request for Action) properties
  private _phaseMap = new Map<number, Set<string>>();
  private _rfaSubscription?: Subscription;

  static _registry: FinalizationRegistry<Subscription> =
    new FinalizationRegistry<Subscription>((sub: Subscription) =>
      { BasePubSub.unsub(sub); },
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

  // Abstract method for context type detection (RFA topic generation)
  protected abstract getContextType(): string;

  // RFA/ITH coordination flow
  protected async _coordinateAndRun(): Promise<void> {
    const contextType = this.getContextType();
    const rfaTopic = `/context/${contextType}/${this._id}/rfa`;
    const ithTopic = `/context/${this._id}/ith`;

    // Set up ITH response listener
    this._rfaSubscription = BasePubSub.sub(
      ithTopic,
      async (args: BasePubSubArgs) => {
         
        const payload = (args as unknown) as { module: string; action: string; phase: number };
        const actionId = `${payload.module}/${payload.action}`;
        
        if (!this._phaseMap.has(payload.phase)) {
          this._phaseMap.set(payload.phase, new Set());
        }
        const phaseActions = this._phaseMap.get(payload.phase);
        if (phaseActions) {
          phaseActions.add(actionId);
        }
      }
    );

    // Publish RFA
    void BasePubSub.create().pub(rfaTopic, { contextId: this._id, contextType });

    // Wait for ITH responses with timeout
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        // Cleanup subscription
        if (this._rfaSubscription) {
          BasePubSub.unsub(this._rfaSubscription);
          this._rfaSubscription = undefined;
        }
        resolve();
      }, 50); // 50ms timeout as specified in RFA.md
    });

    // Fast-fail validation
    if (this._phaseMap.size === 0) {
      const error = new Error(`No handlers were found for ${contextType} context`);
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
    const sortedPhases = Array.from(this._phaseMap.keys()).sort((a, b) => a - b);

    for (const phase of sortedPhases) {
      const actionsInPhase = this._phaseMap.get(phase) ?? new Set();
      
      // Execute all actions in this phase
      const phasePromises = Array.from(actionsInPhase).map(actionId => {
        const [module, action] = actionId.split('/');
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
          void BasePubSub.create().pub(executionTopic, { context: this });
        });
      });

      // Wait for all actions in this phase to complete
      await Promise.all(phasePromises);

      // Check for errors
      if (this._state === "error") {
        return;
      }
    }

    this.done();
  }

  // Validate phase dependencies to prevent paradoxes
  private _validatePhases(): void {
    const di = BaseDi.create();
    
    // Build a map of action to phase for quick lookup
    const actionToPhaseMap = new Map<string, number>();
    for (const [phase, actions] of this._phaseMap.entries()) {
      for (const actionId of actions) {
        actionToPhaseMap.set(actionId, phase);
      }
    }

    // Check each action's dependencies
    for (const [phase, actions] of this._phaseMap.entries()) {
      for (const actionId of actions) {
        const [moduleName, actionName] = actionId.split('/');
        
        try {
          // Resolve the module instance to get action metadata
          const module = di.resolve<BaseModule>(moduleName);
          if (!module) {
            throw new Error(`Could not resolve module '${moduleName}' for phase validation`);
          }
          
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
    void BasePubSub.create().pub(
      this._topicFunction(this._id, module, action, "done"),
    );
  }

  actionError(module: string, action: string) {
    void BasePubSub.create().pub(
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
