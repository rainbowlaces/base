import { LogMessage } from "./logMessage";
import { type LogContext, LogLevel, type SerializedLogMessage, type LoggerConfig, type LogObjectTransformer } from "./types";
import { camelToLowerUnderscore } from "../../utils/string";
import { type Console } from "./console";
import { registerDi } from "../di/decorators/registerDi";
import { di } from "../di/decorators/di";
import { diByTag } from "../di/baseDi";

/**
 * BaseLogger provides a flexible, testable logging solution.
*/
@registerDi()
export class BaseLogger {
  // --- Private Properties ---

  readonly #namespace: string;
  readonly #baseTags: string[];
  readonly #config: LoggerConfig;
  readonly #console: Console;
  readonly #serializers: LogObjectTransformer[];
  readonly #redactors: LogObjectTransformer[];

  /**
   * Get the console method for a specific log level.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _getConsoleMethod(level: string): (message?: any, ...optionalParams: any[]) => void {
    switch (level) {
      case LogLevel[LogLevel.FATAL]:
      case LogLevel[LogLevel.ERROR]:
        return this.#console.error.bind(this.#console);
      case LogLevel[LogLevel.WARNING]:
        return this.#console.warn.bind(this.#console);
      case LogLevel[LogLevel.INFO]:
        return this.#console.log.bind(this.#console);
      case LogLevel[LogLevel.DEBUG]:
        return this.#console.debug.bind(this.#console);
      case LogLevel[LogLevel.TRACE]:
        return this.#console.trace.bind(this.#console);
      default:
        return this.#console.log.bind(this.#console);
    }
  }


  /**
   * Creates a new Logger instance.
   * @param namespace The namespace for this logger instance (e.g., the module name).
   * @param config The logger configuration.
   * @param console The console abstraction for output.
   * @param serializers Array of serializer plugins.
   * @param redactors Array of redactor plugins.
   * @param baseTags An optional array of tags to apply to all messages from this logger.
   */
  constructor(
    namespace: string,
    config: LoggerConfig,
    console: Console,
    serializers: LogObjectTransformer[] = [],
    redactors: LogObjectTransformer[] = [],
    baseTags: string[] = []
  ) {    
    this.#namespace = camelToLowerUnderscore(namespace);
    this.#config = config;
    this.#console = console;
    this.#serializers = serializers;
    this.#redactors = redactors;
    this.#baseTags = baseTags;
  }

  // --- Public Logging API ---

  public fatal(message: string, tags: string[] = [], context?: LogContext): void {
    this.log(message, tags, LogLevel.FATAL, context);
  }

  public error(message: string | Error, tags: string[] = [], context: LogContext = {}): void {
    if (message instanceof Error) {
      this.log(message.message, tags, LogLevel.ERROR, { error: message, ...context });
    } else {
      this.log(message, tags, LogLevel.ERROR, context);
    }
  }

  public warn(message: string, tags: string[] = [], context?: LogContext): void {
    this.log(message, tags, LogLevel.WARNING, context);
  }

  public info(message: string, tags: string[] = [], context?: LogContext): void {
    this.log(message, tags, LogLevel.INFO, context);
  }

  public debug(message: string, tags: string[] = [], context?: LogContext): void {
    this.log(message, tags, LogLevel.DEBUG, context);
  }
  
  public trace(message: string, tags: string[] = [], context?: LogContext): void {
    this.log(message, tags, LogLevel.TRACE, context);
  }

  public log(message: string, tags: string[] = [], level: LogLevel = LogLevel.INFO, context: LogContext = {}): void {
    if (level > (this.#config.logLevel ?? LogLevel.INFO)) {
      return;
    }

    const logMessage = new LogMessage(
        message,
        this.#namespace,
        [...this.#baseTags, ...tags],
        level,
        context,
    );

    try {
        const output = this._format(logMessage);
        const consoleMethod = this._getConsoleMethod(logMessage.level);
        consoleMethod(output);
    } catch(err) {
        // If formatting fails, log a raw error to avoid losing the original message entirely.
        this.#console.error("--- LOGGER FORMATTING ERROR ---", err, "--- ORIGINAL MESSAGE ---", logMessage);
    }


    // A fatal log should terminate the process.
    if (level === LogLevel.FATAL) {
      process.exit(1);
    }
  }

  /**
   * Orchestrates the transformation of a LogMessage instance into a final JSON string.
   * This method implements the two-stage serialization and redaction pipeline.
   *
   * @param logMessage The raw LogMessage instance.
   * @returns A JSON string ready for output.
   */
  private _format(logMessage: LogMessage): string {
    const serializable: SerializedLogMessage = {
      timestamp: logMessage.timestamp,
      level: logMessage.level,
      namespace: logMessage.namespace,
      message: logMessage.message,
      tags: logMessage.tags,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      context: this._applyTransformers(logMessage.context, this.#serializers),
    };

    // Stage 2: Redact the entire plain object if redaction is enabled.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const redacted = (this.#config.redaction ?? true)
      ? this._applyTransformers(serializable, this.#redactors)
      : serializable;

    // Stage 3: Convert the final, safe object to a JSON string.
    return JSON.stringify(redacted, (_key, value: unknown) => {
        if (typeof value === 'bigint') {
            return value.toString();
        }
        return value;
    });
  }

  /**
   * Recursively applies a set of transformers to a given value.
   *
   * This is the core engine of the plugin system. It walks an object tree,
   * and for each value, it finds the first appropriate transformer from the provided
   * list and applies it. If no specific transformer is found, it continues to
   * recurse into child objects and arrays.
   *
   * @param value The value or object to transform.
   * @param transformers An array of transformers (e.g., serializers or redactors).
   * @returns The transformed value or object.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _applyTransformers(value: any, transformers: LogObjectTransformer[]): any {
    const sortedTransformers = [...transformers].sort((a, b) => a.priority - b.priority);
    const seen = new WeakSet<object>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recurse = (val: any): any => {
        if (typeof val === 'object' && val !== null) {
            // Check for circular references
            if (seen.has(val as object)) return '[CircularReference]';
            seen.add(val as object);

            // Check if there's a transformer for this object FIRST
            const objTransformer = sortedTransformers.find(t => t.canTransform(val));
            if (objTransformer) {
                // Transform the object, then recurse into the result
                const transformed = objTransformer.transform(val);
                if (typeof transformed === 'object' && transformed !== null) {
                    // Now recurse into the transformed object's properties
                    const result: Record<string, unknown> | unknown[] = Array.isArray(transformed) ? [] : {};
                    for (const key in transformed) {
                        if (Object.prototype.hasOwnProperty.call(transformed, key)) {
                            if (Array.isArray(result)) {
                                result[parseInt(key, 10)] = recurse((transformed as Record<string, unknown>)[key]);
                            } else {
                                result[key] = recurse((transformed as Record<string, unknown>)[key]);
                            }
                        }
                    }
                    return result;
                } else {
                    return transformed;
                }
            }

            // No transformer for this object, so recurse into its children
            const result: Record<string, unknown> | unknown[] = Array.isArray(val) ? [] : {};
            for (const key in val) {
                if (Object.prototype.hasOwnProperty.call(val, key)) {
                    if (Array.isArray(result)) {
                        result[parseInt(key, 10)] = recurse((val as Record<string, unknown>)[key]);
                    } else {
                        result[key] = recurse((val as Record<string, unknown>)[key]);
                    }
                }
            }
            return result;
        }

        // For primitives, find ALL applicable transformers and chain their results.
        const applicableTransformers = sortedTransformers.filter(t => t.canTransform(val));
        return applicableTransformers.reduce(
            (currentValue, transformer) => transformer.transform(currentValue),
            val
        );
    };

    return recurse(value);
  }
}

/**
 * DI-compatible factory for BaseLogger that resolves dependencies from the DI container.
 * Use this in production code where DI is available.
 */
@registerDi()
export class BaseLoggerFactory {
  @di<LoggerConfig>("Config.BaseLogger")
  accessor #config!: LoggerConfig;

  @di<Console>("NodeConsole")
  accessor #console!: Console;

  @diByTag<LogObjectTransformer>("Logger:Serializer")
  accessor #serializers!: LogObjectTransformer[];

  @diByTag<LogObjectTransformer>("Logger:Redactor")
  accessor #redactors!: LogObjectTransformer[];

  /**
   * Creates a new BaseLogger instance with dependencies resolved from DI.
   */
  public create(namespace: string, baseTags: string[] = []): BaseLogger {
    return new BaseLogger(
      namespace,
      this.#config,
      this.#console,
      this.#serializers,
      this.#redactors,
      baseTags
    );
  }
}
