import { LogMessage } from "./logMessage";
import { type LogContext, LogLevel, type SerializedLogMessage, LoggerConfig, LogObjectTransformer } from "./types";
import { camelToLowerUnderscore } from "../../utils/string";
import { type Console } from "./console";
import { registerDi } from "../di/decorators/registerDi";
import { di } from "../di/decorators/di";
import { diByTag } from "../di/baseDi";

/**
 * BaseLogger provides a flexible, testable logging solution.
*/
export class BaseLogger {
  // --- Private Properties ---

  private readonly _namespace: string;
  private readonly _baseTags: string[];
  private readonly _config: LoggerConfig;
  private readonly _console: Console;
  private readonly _serializers: LogObjectTransformer[];
  private readonly _redactors: LogObjectTransformer[];

  /**
   * Get the console method for a specific log level.
   */
  private _getConsoleMethod(level: string): (message?: any, ...optionalParams: any[]) => void {
    switch (level) {
      case LogLevel[LogLevel.FATAL]:
      case LogLevel[LogLevel.ERROR]:
        return this._console.error.bind(this._console);
      case LogLevel[LogLevel.WARNING]:
        return this._console.warn.bind(this._console);
      case LogLevel[LogLevel.INFO]:
        return this._console.log.bind(this._console);
      case LogLevel[LogLevel.DEBUG]:
        return this._console.debug.bind(this._console);
      case LogLevel[LogLevel.TRACE]:
        return this._console.trace.bind(this._console);
      default:
        return this._console.log.bind(this._console);
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
    this._namespace = camelToLowerUnderscore(namespace);
    this._config = config;
    this._console = console;
    this._serializers = serializers;
    this._redactors = redactors;
    this._baseTags = baseTags;
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
    if (level > (this._config?.logLevel ?? LogLevel.INFO)) {
      return;
    }

    const logMessage = new LogMessage(
        message,
        this._namespace,
        [...this._baseTags, ...tags],
        level,
        context,
    );

    try {
        const output = this._format(logMessage);
        const consoleMethod = this._getConsoleMethod(logMessage.level);
        consoleMethod(output);
    } catch(err) {
        // If formatting fails, log a raw error to avoid losing the original message entirely.
        this._console.error("--- LOGGER FORMATTING ERROR ---", err, "--- ORIGINAL MESSAGE ---", logMessage);
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
      context: this._applyTransformers(logMessage.context, this._serializers),
    };

    // Stage 2: Redact the entire plain object if redaction is enabled.
    const redacted = (this._config?.redaction ?? true)
      ? this._applyTransformers(serializable, this._redactors)
      : serializable;

    // Stage 3: Convert the final, safe object to a JSON string.
    return JSON.stringify(redacted, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    );
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
private _applyTransformers(value: any, transformers: LogObjectTransformer[]): any {
    const sortedTransformers = [...transformers].sort((a, b) => a.priority - b.priority);
    const seen = new WeakSet();

    const recurse = (val: any): any => {
        if (typeof val === 'object' && val !== null) {
            if (seen.has(val)) return '[CircularReference]';
            seen.add(val);

            // Check if there's a transformer for this object FIRST
            const objTransformer = sortedTransformers.find(t => t.canTransform(val));
            if (objTransformer) {
                // Transform the object, then recurse into the result
                const transformed = objTransformer.transform(val);
                if (typeof transformed === 'object' && transformed !== null) {
                    // Now recurse into the transformed object's properties
                    const result = Array.isArray(transformed) ? [] : {};
                    for (const key in transformed) {
                        if (Object.prototype.hasOwnProperty.call(transformed, key)) {
                            (result as Record<string, any>)[key] = recurse((transformed as any)[key]);
                        }
                    }
                    return result;
                } else {
                    return transformed;
                }
            }

            // No transformer for this object, so recurse into its children
            const result = Array.isArray(val) ? [] : {};
            for (const key in val) {
                if (Object.prototype.hasOwnProperty.call(val, key)) {
                    (result as Record<string, any>)[key] = recurse(val[key]);
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
  private accessor _config!: LoggerConfig;

  @di<Console>("NodeConsole")
  private accessor _console!: Console;

  @diByTag<LogObjectTransformer>("Logger:Serializer")
  private accessor _serializers!: LogObjectTransformer[];

  @diByTag<LogObjectTransformer>("Logger:Redactor")
  private accessor _redactors!: LogObjectTransformer[];

  /**
   * Creates a new BaseLogger instance with dependencies resolved from DI.
   */
  public create(namespace: string, baseTags: string[] = []): BaseLogger {
    return new BaseLogger(
      namespace,
      this._config,
      this._console,
      this._serializers,
      this._redactors,
      baseTags
    );
  }
}
