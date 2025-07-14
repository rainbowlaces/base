# `BaseLogger`: The Pluggable, Structured Logging System

This document provides a deep dive into the framework's logging system. The `BaseLogger` is not a simple wrapper around `console.log`. It is a sophisticated, pluggable system designed to produce structured, JSON-formatted logs that are consistent, secure, and machine-readable.

## Core Philosophy

The logger is built on these key principles:

1.  **Structured Logging**: All output is in JSON format. This is essential for modern log aggregation and analysis platforms (e.g., Datadog, Splunk, ELK stack), allowing for powerful filtering, searching, and alerting.
2.  **Pluggable Architecture**: The logger's behavior is not hard-coded. It can be extended with custom "plugins" for serializing complex objects and redacting sensitive data. This is achieved through the DI system.
3.  **Security by Default**: The system includes a redaction pipeline that automatically scans and censors sensitive information (like credit card numbers, emails, etc.) from logs before they are written.
4.  **Testability**: By abstracting the console and using DI, the logger can be easily tested without producing actual console output.

## Core Components

The system is composed of several key classes, interfaces, and decorators.

| Component | File(s) | Role |
| :--- | :--- | :--- |
| **`BaseLogger`** | `baseLogger.ts` | The main, user-facing class. Services inject this to write logs. It orchestrates the entire logging pipeline. |
| **`LogMessage`** | `logMessage.ts` | An internal data class that represents a single, structured log entry before it is formatted and written. |
| **`LoggerConfig`** | `types.ts` | A typed configuration class (`@configClass`) that defines settings like `logLevel`, `redaction` status, and custom redaction patterns. |
| **`LogObjectTransformer`** | `types.ts` | The core interface for all plugins. It defines the `canTransform`, `transform`, and `priority` properties. |
| **Serializers** | `transformers/*.ts` | Implementations of `LogObjectTransformer` that convert complex objects (like `Error` instances) into plain, JSON-serializable objects. |
| **Redactors** | `redactors/*.ts` | Implementations of `LogObjectTransformer` that scan strings for sensitive patterns and replace them. |
| **`@logSerializer`** | `decorators/logSerializer.ts` | A class decorator that registers a class as a "Serializer" plugin. |
| **`@redactor`** | `decorators/logRedactor.ts` | A class decorator that registers a class as a "Redactor" plugin. |

## The Logging Pipeline

When a developer makes a call like `logger.info('User logged in',, { user: userObject })`, the data goes through a multi-stage pipeline before anything is written to the console.

1.  **Initiation & Level Check**: The `info()` method is called. It first checks the configured `logLevel` from the injected `LoggerConfig`. If the message's level (`INFO`) is not severe enough to meet the configured threshold, the process stops immediately for performance.

2.  **`LogMessage` Creation**: A new `LogMessage` instance is created. This object standardizes the log entry, capturing the message, namespace, tags, level, timestamp, and the raw `context` object (`{ user: userObject }`).

3.  **Formatting (`_format` method)**: This private method orchestrates the core two-stage transformation.

      * **Stage 1: Serialization**:

          * The logger retrieves all registered "Serializer" plugins using `@diByTag('Logger:Serializer')`.
          * It passes the `context` object to the `_applyTransformers()` method along with the list of serializers.
          * `_applyTransformers` recursively walks the `context` object. For each value (e.g., the `userObject`), it finds the highest-priority serializer that can handle it (e.g., an `ErrorSerializer` for an `Error` object).
          * The serializer's `transform()` method is called, converting the complex object into a plain, serializable object.
          * The result is a new `SerializedLogMessage` object where the `context` is now guaranteed to be a plain object.

      * **Stage 2: Redaction**:

          * The logger retrieves all registered "Redactor" plugins using `@diByTag('Logger:Redactor')`.
          * It passes the *entire* `SerializedLogMessage` object from Stage 1 to `_applyTransformers()` along with the list of redactors.
          * The method recursively walks the entire log object, including the message, tags, and the now-serialized context.
          * When it encounters a string value, it finds the highest-priority redactor that `canTransform()` it (all `PatternRedactor` based classes can handle any string).
          * The redactor's `transform()` method applies its regex pattern to the string, replacing any sensitive data with a marker like \`\`.

4.  **Final Output**:

      * The fully serialized and redacted plain object is passed to `JSON.stringify()`.
      * The resulting JSON string is written to the appropriate console stream (`console.log`, `console.error`, etc.) via the `Console` abstraction.
      * If the `level` was `FATAL`, `process.exit(1)` is called.

## The Plugin System (`_applyTransformers`)

The power of the logger comes from the `_applyTransformers` method, which implements the plugin system.

  * **Priority-Based**: Transformers (both serializers and redactors) are sorted by their `priority` number (lowest to highest) before execution. This allows for predictable ordering. For example, a highly specific `SSNRedactor` (priority 5) runs before a more general `PhoneNumberRedactor` (priority 15).
  * **First Match Wins**: When transforming a value, the system iterates through the sorted transformers. The *first* one whose `canTransform(value)` method returns `true` is used. Once a value is transformed, the system **does not** attempt to transform it again or recurse into its result. This prevents unpredictable chain reactions.
  * **Recursion**: If no transformer matches a value and the value is an object or array, the system recursively calls itself on the children of that object/array. This ensures the entire context is processed.

## How to Use and Extend

### Getting a Logger Instance

Inject `BaseLogger` into any DI-managed class. The constructor takes a `namespace` string, which will be included in all log messages from that instance.

```typescript
import { di, registerDi, BaseLogger } from '../../index.js';

@registerDi()
export class MyService {
    @di(BaseLogger, 'MyService') // The second argument is the namespace
    private accessor logger!: BaseLogger;

    public doSomething() {
        this.logger.info("MyService is doing something.");
    }
}
```

### Creating a Custom Serializer

Imagine you have a `User` model and you want to log it without exposing all its fields. You can create a custom serializer.

1.  **Create the Serializer Class:**

    ```typescript
    // src/modules/user/userLogSerializer.ts
    import { logSerializer, type LogObjectTransformer } from '../../../core/logger';
    import { User } from './user.model.js';

    @logSerializer() // This decorator registers it with the logger
    export class UserSerializer implements LogObjectTransformer {
        // A low priority ensures it runs before generic object serializers
        readonly priority: number = 20;

        // This serializer only acts on instances of the User class
        public canTransform(value: unknown): value is User {
            return value instanceof User;
        }

        // Transform the User instance into a safe, plain object
        public transform(value: User): unknown {
            return {
                id: value.id.toString(),
                name: value.name,
                email: value.email // The redaction pipeline will handle this field later
            };
        }
    }
    ```

2.  **Use It:** Now, when you log a `User` object, this serializer will be automatically used.

    ```typescript
    const user = await User.byId('some-id');
    this.logger.info("User action performed",, { user });
    // The log output will contain a "user": { "id": "...", "name": "..." } object
    // instead of a generic [Object object] or the full model data.
    ```

### Creating a Custom Redactor

Imagine your application uses internal project IDs with the format `PROJ-XXXXX` that you want to redact from logs.

1.  **Create the Redactor Class:** The easiest way is to extend `PatternRedactor`.

    ```typescript
    // src/modules/project/projectRedactor.ts
    import { redactor, PatternRedactor } from '../../../core/logger';

    @redactor() // This decorator registers it with the logger
    export class ProjectIdRedactor extends PatternRedactor {
        // Higher priority to run before generic redactors if needed
        readonly priority = 40;
        protected readonly patternName = "project_id";
        protected readonly defaultPattern = /PROJ-\d{5}/;
    }
    ```

2.  **It Just Works**: Because of `BaseAutoload`, simply creating this file is enough. The `@redactor` decorator ensures it's registered with the DI container with the `Logger:Redactor` tag. The `BaseLogger` will automatically pick it up and use it in its redaction pipeline. Any log message containing a string like `"Updated status for PROJ-12345"` will be automatically changed to `"Updated status for"`.