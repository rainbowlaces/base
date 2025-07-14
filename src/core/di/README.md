# `BaseDi`: The Dependency Injection Core

This document provides a deep dive into the framework's Dependency Injection (DI) and lifecycle management system. This system is the central nervous system of the entire application, responsible for instantiating classes, wiring them together, and managing their lifecycles from startup to shutdown.

## Core Philosophy

The DI system is designed to enable a highly modular and testable architecture. It achieves this through:

1.  **Inversion of Control (IoC)**: Classes do not create their own dependencies. Instead, they declare what they need, and the DI container provides them. This decouples components from each other.
2.  **Automated Discovery**: The framework automatically discovers and registers injectable classes, eliminating the need for manual registration in a central file.
3.  **Lifecycle Management**: The system manages the entire lifecycle of services, including phased initialization (`setup`) and graceful, ordered shutdown (`teardown`).
4.  **Decorator-Driven API**: The primary way to interact with the DI system is through a clean and declarative set of TypeScript decorators.

## Core Components

The system is composed of three main classes and a suite of decorators.

| Component | File | Role |
| :--- | :--- | :--- |
| **`BaseDi`** | `baseDi.ts` | The static class that acts as the IoC container. It holds all registrations and cached instances. |
| **`BaseAutoload`** | `baseAutoload.ts` | A utility that recursively imports all `.js` files in a directory, triggering the registration of decorated classes. |
| **`BaseInitializer`** | `baseInitializer.ts` | Manages the ordered execution of `setup` methods for services that require initialization at startup. |
| **Decorators** | `decorators/*.ts` | The user-facing API (`@registerDi`, `@di`, `@diByTag`) for registering and injecting dependencies. |

## The DI Lifecycle: From Autoload to Teardown

The DI system orchestrates the entire application lifecycle in a predictable sequence.

### 1\. Autoloading & Registration

The process begins when `Base.start()` calls `BaseAutoload.autoload()`.

  * `BaseAutoload` recursively scans the project directories for `.js` files.
  * As each file is dynamically `import()`-ed by Node.js, the code is executed.
  * This execution triggers any class decorators. The **`@registerDi`** decorator on a class immediately calls `BaseDi.register()`, adding the class's metadata (its constructor, key, singleton status, phase, tags, etc.) to the `BaseDi.registrations` map.
  * If a class is registered with `setup: true`, the `@registerDi` decorator also calls `BaseInitializer.register()`, adding the class name to a list of services that need to be initialized.

At the end of this phase, the `BaseDi` container is aware of all injectable classes in the application, and the `BaseInitializer` knows which ones require setup.

### 2\. Phased Initialization

After autoloading, `Base.init()` calls `BaseInitializer.run()`.

1.  The `BaseInitializer` groups all registered setup services by their `phase` number (defaulting to 100).
2.  It sorts the phases in ascending order (e.g., 10, 30, 90, 100).
3.  It iterates through each phase, from lowest to highest.
4.  For each service within a phase, it calls `BaseDi.resolve()` to get the singleton instance (creating and caching it if it doesn't exist yet).
5.  It then calls the `.setup()` method on that instance.
6.  It uses `Promise.all()` to wait for all `setup()` methods within a single phase to complete before moving to the next phase.

This phased approach guarantees that foundational services (like `BaseConfig` at phase 10 and `BasePubSub` at phase 30) are fully initialized before dependent services (like `BaseModule`s at phase 90) attempt to use them.

### 3\. Runtime Resolution

During the application's life (e.g., while handling an HTTP request), services are resolved on-demand.

  * When a class property decorated with **`@di`** or **`@diByTag`** is accessed for the first time, the decorator's `get()` method is triggered.
  * This method calls `BaseDi.resolve()` or `BaseDi.resolveByTag()`.
  * `BaseDi` checks its `instances` cache for a matching singleton. If found, it's returned immediately.
  * If not found, it looks up the registration, instantiates the class (and all of *its* dependencies recursively), caches it if it's a singleton, and returns the new instance.
  * The system includes robust circular dependency detection to prevent infinite loops during resolution.

### 4\. Graceful Teardown

When the application needs to shut down, `BaseDi.teardown()` is called. This process is the reverse of initialization.

1.  It gathers all registered singleton services that have a `teardown` method (or were registered with `teardown: true`).
2.  It groups them by phase, just like the initializer.
3.  It sorts the phases in **descending order** (e.g., 100, 90, 30, 10).
4.  It iterates through the reversed phases, calling the `.teardown()` method on each cached singleton instance.

This ensures that higher-level modules are torn down before their underlying dependencies, preventing errors during shutdown. After all teardown methods complete, `BaseDi.reset()` is called to clear all registrations and instances, making the container ready for a clean restart (which is especially useful in testing environments).

## The Decorator API

Decorators provide a clean, declarative interface to the DI system.

### `@registerDi(options)`

This is a class decorator that registers a class with the `BaseDi` container.

**Options:**

  * `key?: string`: A unique key for the registration. Defaults to the class name.
  * `singleton?: boolean`: If `true`, only one instance of this class will be created for the application's lifetime. Defaults to `false`.
  * `phase?: number`: An integer used for ordering `setup` and `teardown` calls. Lower numbers run first on setup, last on teardown. Defaults to `100`. Requires `singleton: true`.
  * `setup?: boolean`: If `true`, the class must have a `setup(): Promise<void>` method, which will be called by `BaseInitializer`. Requires `singleton: true`.
  * `teardown?: boolean`: If `true`, the class should have a `teardown(): Promise<void>` method, which will be called during `BaseDi.teardown()`. Requires `singleton: true`.
  * `tags?: string`: An array of string tags used to group related services.

**Example:**

```typescript
@registerDi({ singleton: true, setup: true, phase: 50, tags: })
export class DatabaseService {
    async setup() { /*... connect to database... */ }
    async teardown() { /*... disconnect from database... */ }
}
```

### `@di(keyOrClass,...args)`

This is an accessor decorator for injecting a single dependency.

**Parameters:**

  * `keyOrClass`: The key (string) or the class constructor of the dependency to inject.
  * `...args`: Optional arguments to pass to the constructor if the dependency is not a singleton and is being created for the first time.

**Example:**

```typescript
import { di } from "./baseDi.js";
import { BaseLogger } from "../logger/baseLogger.js";

@registerDi()
export class MyService {
    @di(BaseLogger, 'MyServiceNamespace') // Injects BaseLogger, passing a namespace to its constructor
    private accessor logger!: BaseLogger;

    doWork() {
        this.logger.info("Doing work...");
    }
}
```

### `@diByTag(tag)`

This is an accessor decorator for injecting an array of all services registered with a specific tag. This is ideal for plugin-based architectures.

**Parameters:**

  * `tag`: The string tag to look for.

**Example:**

```typescript
// In src/core/logger/baseLogger.ts
@diByTag("Logger:Serializer")
private accessor serializers!: LogObjectTransformer; // Injects all log serializers
```

This decorator allows the `BaseLogger` to be completely unaware of how many or what kind of serializers exist. Any developer can add a new serializer to the system by simply creating a class, decorating it with `@registerDi({ tags: })`, and the logger will automatically discover and use it.