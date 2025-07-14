# `BaseModule`: The Application Logic Layer

This document describes the `BaseModule` system, the primary architectural pattern for organizing business logic within the framework. This system provides a structured, decoupled, and lifecycle-aware way to define and execute units of work, known as "Actions," within managed "Contexts."

## Core Philosophy

The module system is designed to break down a complex application into logical, self-contained units.

1.  **Organization**: **Modules** (`BaseModule`) act as containers for related business logic. A `UserModel` might handle user creation and authentication, while an `EmailModule` handles sending notifications.
2.  **Orchestration**: **Contexts** (`BaseContext`) are short-lived orchestrators that manage the execution of a specific process, such as application initialization (`BaseInitContext`) or handling an incoming HTTP request (`BaseHttpContext`). A Context is responsible for finding all the relevant Actions for a task and running them in the correct order.
3.  **Encapsulation**: **Actions** (`@init`) are methods within a Module that perform a specific task. They are discovered and invoked by a Context, never called directly from outside their own module.
4.  **Dependency Management**: Actions can declare dependencies on other actions using the `@dependsOn` decorator. The Context is responsible for resolving this dependency graph, ensuring that actions run only after their prerequisites are met. This is a powerful feature for managing complex workflows.

## The Execution Flow: How It All Works

The entire system is a collaboration between Modules, Actions, and a Context, powered by the `BasePubSub` event bus. Let's trace the application startup process, which is managed by the `BaseInitContext`.

1.  **Framework Initialization**: The main `Base` class finishes its `setup()` phase and publishes a single event: `pubsub.pub('/init', { ... })`.

2.  **Context Creation**: The `BaseInitContext` is a service that is instantiated by the DI container. Its constructor is triggered by the `/init` event, and it immediately begins its work by calling `this.coordinateAndRun("/init")`.

3.  **Action Discovery (`coordinateAndRun`)**:

      * The `BaseContext` calls its static `getActionsForTopic('/init')` method.
      * This method scans a central **Action Registry**. Any method decorated with `@init` anywhere in the application has already been registered against the `/init` topic by its decorator.
      * The context now has a list of all Actions that need to run for the application to be considered "initialized."

4.  **Phased Execution Planning**:

      * The context organizes the discovered actions into a `phaseMap` (a `Map<number, Set<string>>`), grouping them by the `phase` number specified in their decorator (e.g., `@init({ phase: 10 })`).
      * It then runs `_validatePhases()`. This is a critical step that checks for dependency paradoxes. For example, it will throw an error if `ActionA` (in phase 100) declares a dependency on `ActionB` (in phase 200), because dependencies must run in the same phase or an *earlier* one.

5.  **Action Execution (`_runPhases`)**:

      * The context sorts the phases numerically and begins executing them one by one.
      * For each phase, it triggers all actions within that phase **in parallel**.
      * It triggers an action not by calling it directly, but by publishing another, more specific event to the bus, like `/context/execute/ModelsModule/seedDatabase`.

6.  **Module Execution (`executeAction`)**:

      * Each module's `@init` decorator has already created a subscriber for these specific `/context/execute/...` events. When the event is received, the module's `executeAction` method is invoked.
      * `executeAction` checks the action's dependencies declared via `@dependsOn`. It calls `context.waitFor(dependencies)`.
      * The `waitFor` method is a `Promise` that only resolves when the context's internal `actionLog` shows that all required dependency actions have completed successfully. It listens for `dependencyDone` events emitted by the context.
      * Once all dependencies are met, the original action method (e.g., `seedDatabase`) is finally executed.

7.  **Signaling Completion**:

      * Upon successful completion, the action calls `context.actionDone(module, action)`.
      * This publishes a final status event (e.g., `/base/init/context-id/ModelsModule/seedDatabase/done`), which the context is listening for.
      * The context adds the action to its `actionLog`, which may unblock other actions that were waiting for it to finish.

This sophisticated, event-driven choreography ensures a robust, ordered, and parallelizable execution of complex workflows.

## Core Components

| Component | File(s) | Role |
| :--- | :--- | :--- |
| **`BaseModule`** | `baseModule.ts` | The abstract class that all modules must extend. It provides a shared `namespace`, a pre-configured `logger`, and injected `config`. |
| **`BaseContext`** | `baseContext.ts` | The abstract orchestrator for a sequence of actions. Manages state, dependencies, and phased execution. |
| **`BaseInitContext`** | `initContext.ts` | A concrete implementation of `BaseContext` designed specifically to handle the application's startup (`/init`) process. |
| **`@baseModule`** | `decorators/baseModule.ts` | A class decorator that registers the module with the DI container as a singleton with lifecycle hooks, ready for autoloading. |
| **`@init`** | `decorators/init.ts` | A method decorator that designates a method as an "init action." It registers the action with the central `BaseContext.actionRegistry` for the `/init` topic. |
| **`@dependsOn`** | `decorators/dependsOn.ts` | A method decorator that specifies prerequisites for an action. It's the key to controlling execution order. |

## How to Create a Module and Manage Dependencies

Here’s a practical example of creating two modules where one's initialization depends on the other.

#### Step 1: Define the `CacheModule`

This module will "warm up" a cache during startup. It runs in an early phase.

```typescript
// src/modules/cache.ts
import { baseModule, BaseModule, init } from '../core/module';

@baseModule
export class CacheModule extends BaseModule {

    @init({ phase: 50 }) // Run in an early phase
    async warmUpCache() {
        this.logger.info("Warming up the cache...");
        // Simulate an async operation
        await new Promise(resolve => setTimeout(resolve, 100));
        this.logger.info("Cache is warm.");
    }
}
```

#### Step 2: Define the `ReportingModule`

This module generates a report, but it must only run *after* the cache is ready.

```typescript
// src/modules/reporting.ts
import { baseModule, BaseModule, init, dependsOn } from '../core/module';
import { CacheModule } from './cache.ts';

@baseModule
export class ReportingModule extends BaseModule {

    // This action depends on the `warmUpCache` action from the `CacheModule`.
    // It runs in a later phase to ensure the dependency can be met.
    @init({ phase: 100 })
    @dependsOn('warmUpCache', CacheModule)
    async generateInitialReport() {
        this.logger.info("Generating initial report (cache is guaranteed to be warm)...");
        // ... reporting logic ...
        this.logger.info("Report generated.");
    }
}
```

#### What Happens at Startup

1.  Both modules are autoloaded and registered.
2.  `BaseInitContext` starts, discovers both `@init` actions: `CacheModule/warmUpCache` (phase 50) and `ReportingModule/generateInitialReport` (phase 100).
3.  It starts with **Phase 50**. It triggers the execution of `warmUpCache`.
4.  The `warmUpCache` action runs and completes. It calls `context.actionDone()`.
5.  The context logs `CacheModule/warmUpCache` as "done" and moves to **Phase 100**.
6.  It triggers the execution of `generateInitialReport`.
7.  The `ReportingModule`'s `executeAction` method sees the `@dependsOn` and calls `context.waitFor(['CacheModule/warmUpCache'])`.
8.  The context checks its log, sees that the dependency is already met, and the `waitFor` promise resolves instantly.
9.  The `generateInitialReport` method body executes.

This system guarantees that no matter how many modules and dependencies you add, the initialization process remains predictable and robust.