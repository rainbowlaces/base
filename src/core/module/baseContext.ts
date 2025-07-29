import { nanoid } from "nanoid";
import { EventEmitter } from "events";
import { BasePubSub } from "../pubsub/basePubSub.js";
import { BaseDi, di } from "../di/baseDi.js";
import { BaseError } from "../baseErrors.js";
import { type BaseAction, type ContextState, type ModuleStatusArgs, type TopicFunction } from "./types.js";
import { type BasePubSubArgs, type Subscription } from "../pubsub/types.js";
import { type BaseModule } from "./baseModule.js";
import { BaseLogger } from "../logger/baseLogger.js";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BaseContextData {}

export abstract class BaseContext<
  T extends BaseContextData = BaseContextData,
> extends EventEmitter {
  #id: string;
  #created: number = Date.now();
  #actionLog: Set<string> = new Set<string>();
  #topicFunction: TopicFunction;

  @di(BasePubSub)
  private static accessor pubsub: BasePubSub;

  @di(BaseLogger, "HttpHandler")
  protected accessor logger!: BaseLogger;

  #data: T = {} as T;
  #state: ContextState = "pending";

  private static readonly actionRegistry = new Map<URLPattern, BaseAction[]>();

  static registerAction(topic: string, action: BaseAction): void {
    const logger = BaseDi.resolve(BaseLogger, "HttpHandler");
    logger.debug(`Registering action ${action.module}/${action.name} for topic ${topic}`);
    
    try {
      const urlPattern = new URLPattern({ pathname: topic });
      if (!BaseContext.actionRegistry.has(urlPattern)) {
        BaseContext.actionRegistry.set(urlPattern, []);
      }
      BaseContext.actionRegistry.get(urlPattern)?.push(action);
    } catch (error) {
      logger.error(`Failed to create URLPattern for topic '${topic}', skipping registration`, [], { error });
    }
  }

  static getActionsForTopic(topic: string): { actions: BaseAction[], params: Record<string, string> } {
    const matchingActions: BaseAction[] = [];
    const extractedParams: Record<string, string> = {};
    const logger = BaseDi.resolve(BaseLogger, "HttpHandler");
    
    logger.debug(`Finding actions for topic: ${topic}`);
    
    // Iterate through all registered URLPattern keys and test them against the topic
    for (const [urlPattern, actions] of BaseContext.actionRegistry.entries()) {
      try {
        const match = urlPattern.exec(topic);
        if (match?.pathname.groups) {
          logger.debug(`URLPattern matches topic '${topic}', adding ${actions.length} actions`);
          matchingActions.push(...actions);
          
          // Extract and merge parameters from this match
          const pathParams = Object.fromEntries(
            Object.entries(match.pathname.groups).filter(([_, value]) => value !== undefined)
          );
          Object.assign(extractedParams, pathParams);
          logger.debug(`Extracted parameters: ${JSON.stringify(pathParams)}`);
        } else {
          logger.debug(`URLPattern does not match topic '${topic}'`);
        }
      } catch (error) {
        logger.error(`Error testing URLPattern against topic '${topic}'`, [], { error });
      }
    }
    
    logger.debug(`Found ${matchingActions.length} total actions matching topic: ${topic}`);
    logger.debug(`Total extracted parameters: ${JSON.stringify(extractedParams)}`);
    return { actions: matchingActions, params: extractedParams };
  }

  // Phase execution properties
  #phaseMap = new Map<number, Set<string>>();
  #urlParams: Record<string, string> = {};

  static #registry: FinalizationRegistry<Subscription> =
    new FinalizationRegistry<Subscription>((sub: Subscription) => {
      BaseContext.pubsub.unsub(sub);
    });

  constructor(topicFunction: TopicFunction) {
    super();
    this.#id = nanoid();
    this.#topicFunction = topicFunction;
    this.logger.debug(`BaseContext created with ID: ${this.#id}`);

    const sub = BaseContext.pubsub.sub(
      topicFunction(this.#id, ":module", ":action", ":status"),
      async (args: BasePubSubArgs) => {
        const modArgs = args as ModuleStatusArgs;
        const dep = `${modArgs.module}/${modArgs.action}`;
        this.logger.debug(`Received module status for ${dep}: ${modArgs.status}`);
        if (modArgs.status === "error") {
          this.logger.debug(`Module ${dep} reported error, setting context to error state`);
          this.error();
          return this.emit("dependencyError", dep);
        }
        this.#actionLog.add(dep);
        this.logger.debug(`Added ${dep} to action log. Total actions: ${this.#actionLog.size}`);
        this.start();
        return this.emit("dependencyDone", dep);
      }
    );
    this.logger.debug(`Subscribed to module status topic: ${topicFunction(this.#id, ":module", ":action", ":status")}`);
    BaseContext.#registry.register(this, sub);
  }

  // Direct registry-based coordination flow
  protected async coordinateAndRun(topic: string): Promise<void> {
    try {
      this.logger.debug(`Starting coordination flow for topic: ${topic}`);
      
      // Look up actions using URL pattern matching
      const { actions, params } = BaseContext.getActionsForTopic(topic);
      this.logger.debug(`Found ${actions.length} actions matching topic: ${topic}`);
      
      // Store extracted parameters for use in action execution
      this.#urlParams = params;
      this.logger.debug(`Stored URL parameters: ${JSON.stringify(params)}`);

      // Build phase map from registered actions
      for (const action of actions) {
        const actionId = `${action.module}/${action.name}`;
        this.logger.debug(`Processing action: ${actionId} for phase ${action.phase}`);

        if (!this.#phaseMap.has(action.phase)) {
          this.#phaseMap.set(action.phase, new Set());
          this.logger.debug(`Created new phase ${action.phase}`);
        }
        const phaseActions = this.#phaseMap.get(action.phase);
        if (phaseActions) {
          phaseActions.add(actionId);
          this.logger.debug(`Added ${actionId} to phase ${action.phase}. Phase now has ${phaseActions.size} actions`);
        }
      }

      // Check for a legitimate handler, ignoring middleware
      const hasRouteHandlers = actions.some(action => !action.middleware);

      if (!hasRouteHandlers) {
        this.logger.debug(`No explicit route handlers found for topic: ${topic}, only middleware.`);
        throw new Error(
          `No handlers were found for topic: ${topic}`
        );
      }

      this.logger.debug(`Found ${this.#phaseMap.size} phases with handlers`);
      // Validate phase dependencies before execution
      this._validatePhases();

      // Run phases
      await this._runPhases();
    } catch (error) {
      // Ensure context is in error state for any coordination failures
      this.error();
      throw error;
    }
  }

  // Sequential phase execution
  private async _runPhases(): Promise<void> {
    this.logger.debug("Starting sequential phase execution");
    const sortedPhases = Array.from(this.#phaseMap.keys()).sort(
      (a, b) => a - b
    );
    this.logger.debug(`Executing phases in order: [${sortedPhases.join(", ")}]`);

    for (const phase of sortedPhases) {
      const actionsInPhase = this.#phaseMap.get(phase) ?? new Set();
      this.logger.debug(`Starting phase ${phase} with ${actionsInPhase.size} actions: [${Array.from(actionsInPhase).join(", ")}]`);

      // Execute all actions in this phase
      const phasePromises = Array.from(actionsInPhase).map((actionId) => {
        const [module, action] = actionId.split("/");
        const executionTopic = `/context/execute/${module}/${action}`;
        this.logger.debug(`Setting up execution for ${actionId} on topic: ${executionTopic}`);

        return new Promise<void>((resolve) => {
          // Wait for this specific action to complete
          const completionHandler = (dep: string) => {
            if (dep === actionId) {
              this.logger.debug(`Action ${actionId} completed in phase ${phase}`);
              this.off("dependencyDone", completionHandler);
              resolve();
            }
          };
          this.on("dependencyDone", completionHandler);

          // Trigger the action execution
          this.logger.debug(`Triggering execution of ${actionId}`);
          void BaseContext.pubsub.pub(executionTopic, { 
            context: this, 
            ...this.#urlParams 
          });
        });
      });

      // Wait for all actions in this phase to complete
      this.logger.debug(`Waiting for all ${phasePromises.length} actions in phase ${phase} to complete`);
      await Promise.all(phasePromises);
      this.logger.debug(`Phase ${phase} completed successfully`);

      // Check for errors
      if (this.#state === "error") {
        this.logger.debug(`Context entered error state during phase ${phase}, stopping execution`);
        return;
      }
    }

    this.logger.debug("All phases completed successfully");
    this.done();
  }

  // Validate phase dependencies to prevent paradoxes
  private _validatePhases(): void {
    this.logger.debug("Starting phase dependency validation");
    // Build a map of action to phase for quick lookup
    const actionToPhaseMap = new Map<string, number>();
    for (const [phase, actions] of this.#phaseMap.entries()) {
      for (const actionId of actions) {
        actionToPhaseMap.set(actionId, phase);
      }
    }
    this.logger.debug(`Built action-to-phase map with ${actionToPhaseMap.size} entries`);

    // Check each action's dependencies
    for (const [phase, actions] of this.#phaseMap.entries()) {
      this.logger.debug(`Validating dependencies for phase ${phase}`);
      for (const actionId of actions) {
        const [moduleName, actionName] = actionId.split("/");
        this.logger.debug(`Checking dependencies for action ${actionId}`);

        try {
          // Resolve the module instance to get action metadata
          const module = BaseDi.resolve<BaseModule>(moduleName);

          // Get the action from the module
          const action = module.getAction(actionName);
          if (!action?.dependsOn) {
            this.logger.debug(`Action ${actionId} has no dependencies`);
            continue; // No dependencies to validate
          }

          this.logger.debug(`Action ${actionId} depends on: [${action.dependsOn.join(", ")}]`);
          // Check each dependency
          for (const depId of action.dependsOn) {
            const depPhase = actionToPhaseMap.get(depId);

            if (depPhase === undefined) {
              this.logger.debug(`Dependency ${depId} not found in execution plan`);
              // Dependency not found in current execution plan
              throw new BaseError(
                `Dependency Resolution Error: Action '${actionId}' (Phase ${phase}) ` +
                  `depends on '${depId}' which is not scheduled for execution in this context.`
              );
            }

            // Check for phase paradox
            if (depPhase > phase) {
              this.logger.debug(`Phase paradox detected: ${actionId} (phase ${phase}) depends on ${depId} (phase ${depPhase})`);
              throw new BaseError(
                `Phase Dependency Paradox: Action '${actionId}' (Phase ${phase}) ` +
                  `depends on '${depId}' (Phase ${depPhase}). ` +
                  `Dependencies must be in the same phase or an earlier phase.`
              );
            }
            this.logger.debug(`Dependency ${depId} (phase ${depPhase}) is valid for ${actionId} (phase ${phase})`);
          }
        } catch (error) {
          // Re-throw with context
          if (error instanceof Error) {
            this.logger.debug(`Phase validation failed: ${error.message}`);
            throw new BaseError(`Phase validation failed: ${error.message}`);
          }
          throw error;
        }
      }
    }
    this.logger.debug("Phase dependency validation completed successfully");
  }

  actionDone(module: string, action: string) {
    this.logger.debug(`Marking action as done: ${module}/${action}`);
    void BaseContext.pubsub.pub(
      this.#topicFunction(this.#id, module, action, "done")
    );
  }

  actionError(module: string, action: string) {
    this.logger.debug(`Marking action as error: ${module}/${action}`);
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
    this.logger.debug(`Context ${this.#id} transitioning to done state`);
    this.#state = "done";
  }

  error() {
    if (this.#state === "done") return;
    this.logger.debug(`Context ${this.#id} transitioning to error state`);
    this.#state = "error";
  }

  start() {
    if (this.#state === "done") return;
    if (this.#state === "error") return;
    this.logger.debug(`Context ${this.#id} transitioning to running state`);
    this.#state = "running";
  }

  private matchDependencies(dependencies: string[]): boolean {
    const matched = dependencies.every((dep) => this.#actionLog.has(dep));
    this.logger.debug(`Dependency check for [${dependencies.join(", ")}]: ${matched ? "matched" : "not matched"}. Current actions: [${Array.from(this.#actionLog).join(", ")}]`);
    return matched;
  }

  public async waitFor(dependencies: string[]): Promise<void> {
    this.logger.debug(`Waiting for dependencies: [${dependencies.join(", ")}]`);
    if (this.matchDependencies(dependencies)) {
      this.logger.debug("Dependencies already satisfied, returning immediately");
      return;
    }

    function depHandler(
      this: BaseContext<T>,
      resolve: () => void,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: any
    ) {
      if (this.matchDependencies(dependencies)) {
        this.logger.debug(`Dependencies [${dependencies.join(", ")}] now satisfied`);
         
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
        this.logger.debug(`Dependency error occurred while waiting for [${dependencies.join(", ")}]`);
        reject(new Error(`Dependencies not met: ${dependencies.join(", ")}`));
      });
    });
  }
}