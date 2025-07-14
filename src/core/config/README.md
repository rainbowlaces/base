# `BaseConfig`: The Modular Configuration System

This document provides a deep dive into the framework's configuration management system. This system is designed to be modular, type-safe, environment-aware, and deeply integrated with the core Dependency Injection (DI) container.

## Core Philosophy

The configuration system is built on these key principles:

1.  **Modularity**: Each module can define and provide its own configuration without modifying a central, monolithic config file.
2.  **Type Safety**: Configuration is not just a plain object. It's hydrated into strongly-typed classes, providing full autocompletion and compile-time checks for consumers.
3.  **Environment-Specific Overrides**: A base `default` configuration can be easily overridden by environment-specific configurations (e.g., `development`, `production`).
4.  **DI Integration**: Final, hydrated configuration objects are registered as injectable singletons in the `BaseDi` container, making them easily accessible to any service or module.

## Core Components

The system is composed of several key classes and decorators that work in concert.

| Component | File | Role |
| :--- | :--- | :--- |
| **`BaseConfigProvider`** | `baseConfigRegistry.ts` | An abstract class that modules extend to supply a piece of the total application configuration. |
| **`@provider`** | `decorators/provider.ts` | A class decorator that registers a `BaseConfigProvider` with the system. |
| **`BaseClassConfig`** | `types.ts` | A base class that provides a `hydrate()` method, allowing typed config classes to be populated from plain objects. |
| **`@configClass`** | `decorators/provider.ts` | A class decorator that registers a typed configuration class and links it to a specific configuration namespace (e.g., "BaseLogger"). |
| **`BaseConfigRegistry`** | `baseConfigRegistry.ts` | The central orchestrator. It collects all providers, merges their configs, and registers the final, typed config objects into the DI container. |
| **`BaseConfig`** | `baseConfig.ts` | A simple setup service whose only job is to kickstart the `BaseConfigRegistry` during the application's initialization phase. |
| **`@config`** | `decorators/config.ts` | The consumer-facing accessor decorator. It provides a clean, type-safe way for services to inject the configuration they need. |

## The Configuration Lifecycle

Understanding the configuration system requires tracing its lifecycle from application startup to consumption within a service.

### 1\. Registration (Application Startup)

When the application starts, `BaseAutoload` imports all module files. As these files are loaded, the decorators on configuration-related classes execute immediately.

  * **`@provider()`**: When the interpreter sees `@provider()` on a class like `AppConfig`, it instantiates that class and calls `BaseConfigRegistry.register(provider)`. This adds the provider instance to a static array, `BaseConfigRegistry.providers`.
  * **`@configClass("Namespace")`**: When the interpreter sees `@configClass("BaseLogger")` on the `LoggerConfig` class, it adds the class constructor to a static `Map`, `CONFIG_CLASS_REGISTRY`, mapping the namespace string `"BaseLogger"` to the `LoggerConfig` class itself.

At the end of the autoload phase, `BaseConfigRegistry` holds a list of all potential configuration sources, and a separate registry holds a map of all special, typed configuration classes.

### 2\. Assembly (The `setup` Phase)

The `BaseConfig` service is registered with `setup: true` and `phase: 10`. This means that early in the application's startup sequence, `BaseInitializer` will execute its `setup()` method.

1.  `BaseConfig.setup()` is called.
2.  It resolves the current environment (`env`) from the DI container.
3.  It then resolves the `BaseConfigRegistry` for that specific environment: `BaseDi.resolve(BaseConfigRegistry, env)`. This is the trigger for the main event.

### 3\. Orchestration (Inside `BaseConfigRegistry` Constructor)

The constructor of `BaseConfigRegistry` is where the configuration is assembled.

1.  **Filter & Sort Providers**: It takes the static list of all registered providers and filters them, keeping only those for `'default'` and the current environment (e.g., `'development'`). It then sorts them by priority, ensuring `default` configs are applied first and environment-specific ones override them.
2.  **Merge Configurations**: It iterates through the sorted providers and recursively merges their `config` objects into a single, comprehensive configuration object using the `merge()` utility.
3.  **Hydrate Typed Classes**: It retrieves the map of all classes registered with `@configClass`. It iterates through this map. For each `[namespace, configClass]`:
      * It looks up the corresponding data from the merged configuration object (e.g., for the `"BaseLogger"` namespace, it gets the `BaseLogger` object).
      * It creates a new instance of the class (e.g., `new LoggerConfig()`).
      * It calls `instance.hydrate(moduleConfig)`, populating the class instance with the data from the merged config.
      * It registers this fully-hydrated, typed instance as a singleton in the DI container with a key like **`Config.BaseLogger`**.
4.  **Register Remaining Configs**: If there are any configuration namespaces that did not have a corresponding `@configClass`, it registers them as plain objects in the DI container.

At the end of this process, the DI container is populated with ready-to-use, fully-configured, and type-safe singleton objects for each configuration namespace.

### 4\. Consumption (In a Service)

When a service needs configuration, it uses the `@config` accessor decorator.

```typescript
// Example from src/core/logger/baseLogger.ts
@config<LoggerConfig>("BaseLogger")
private accessor config!: LoggerConfig;
```

This is elegant syntactic sugar for a `BaseDi.resolve()` call. When `this.config` is accessed for the first time:

1.  The `get()` method of the decorator's returned descriptor is executed.
2.  It constructs the key `Config.BaseLogger`.
3.  It calls `BaseDi.resolve<LoggerConfig>('Config.BaseLogger')`.
4.  The DI container returns the singleton instance of the hydrated `LoggerConfig` class that was created by `BaseConfigRegistry` during the setup phase.

## How to Use: A Practical Guide

Here’s how a developer would add a new, configurable `CacheModule`.

#### Step 1: Define a Typed Config Class

Create a class that defines the shape of your configuration. This provides type safety.

```typescript
// src/modules/cache/cacheConfig.ts
import { BaseClassConfig, configClass, type ConfigData } from '../../core/config';

@configClass("CacheModule") // The namespace for this config
export class CacheModuleConfig extends BaseClassConfig {
    // Default values
    ttl: number = 3600; // 1 hour
    host: string = 'localhost';
    port: number = 6379;
}

// Use declaration merging to add it to the global config type for full type safety
declare module "../../core/config/types.js" {
    interface BaseAppConfig {
        CacheModule?: ConfigData<CacheModuleConfig>;
    }
}
```

#### Step 2: Create Configuration Providers

Provide the actual configuration data. You typically create a default provider and can add environment-specific ones.

**Default Config:**

```typescript
// src/modules/cache/config/default.ts
import { BaseConfigProvider, provider, type BaseAppConfig } from '../../../index.js';

@provider('default', 0) // 'default' environment, priority 0 (runs first)
export class DefaultCacheConfig extends BaseConfigProvider {
    get config(): Partial<BaseAppConfig> {
        return {
            CacheModule: {
                host: 'redis-cache.internal'
            }
        };
    }
}
```

**Production Override:**

```typescript
// src/modules/cache/config/production.ts
import { BaseConfigProvider, provider, type BaseAppConfig } from '../../../index.js';

@provider('production', 100) // 'production' env, priority 100 (runs after default)
export class ProductionCacheConfig extends BaseConfigProvider {
    get config(): Partial<BaseAppConfig> {
        return {
            CacheModule: {
                host: 'prod-redis-cluster.internal',
                ttl: 86400 // 24 hours
            }
        };
    }
}
```

#### Step 3: Consume the Configuration in a Service

Inject and use the typed configuration in your module's service.

```typescript
// src/modules/cache/cacheService.ts
import { baseModule, BaseModule, config } from '../../index.js';
import { CacheModuleConfig } from './cacheConfig.js';

@baseModule
export class CacheService extends BaseModule {

    @config<CacheModuleConfig>("CacheModule")
    private accessor config!: CacheModuleConfig;

    public async connect() {
        // this.config is a fully typed and hydrated instance of CacheModuleConfig
        this.logger.info(`Connecting to cache at ${this.config.host}:${this.config.port}`);
        this.logger.info(`Default TTL is ${this.config.ttl} seconds.`);
        //... connection logic
    }
}
```

When this application runs in production, the `CacheService` will have a `config` object where `host` is `'prod-redis-cluster.internal'` and `ttl` is `86400`. In any other environment, it will use the default `host` and the default `ttl` of `3600`.