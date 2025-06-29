import { registerDi } from "../di/decorators/registerDi";
import { di } from "../di/decorators/di";
import { LogMessage } from "./logMessage";
import { type LogContext, LogLevel, type SerializedLogMessage, LoggerConfig, LogObjectTransformer } from "./types";
import { diByTag } from "../di/baseDi";
import { camelToLowerUnderscore } from "../../utils/string";

/**
 * BaseLogger provides a DI-driven, extensible logging solution.
*/
@registerDi()
export class BaseLogger {
  // --- Injected Dependencies ---

  /**
   * The logger's configuration object.
   * Injected from the DI container, sourced from the main application config.
   */
  @di<LoggerConfig>("Config.BaseLogger")
  private accessor _config!: LoggerConfig;

  /**
   * An array of all registered serializer plugins.
   * Injected by the DI container by looking for the 'Logger:Serializer' tag.
   */
  @diByTag<LogObjectTransformer>("Logger:Serializer")
  private accessor _serializers!: LogObjectTransformer[];

  /**
   * An array of all registered redactor plugins.
   * Injected by the DI container by looking for the 'Logger:Redactor' tag.
   */
  @diByTag<LogObjectTransformer>("Logger:Redactor")
  private accessor _redactors!: LogObjectTransformer[];

  // --- Private Properties ---

  private readonly _namespace: string;
  private readonly _baseTags: string[];

  /**
   * Map of log levels to their corresponding console output functions.
   */
  private static readonly _levelMap: Record<string, (message?: any, ...optionalParams: any[]) => void> = {
    [LogLevel[LogLevel.FATAL]]: console.error,
    [LogLevel[LogLevel.ERROR]]: console.error,
    [LogLevel[LogLevel.WARNING]]: console.warn,
    [LogLevel[LogLevel.INFO]]: console.log,
    [LogLevel[LogLevel.DEBUG]]: console.debug,
    [LogLevel[LogLevel.TRACE]]: console.trace,
  };


  /**
   * Creates a new Logger instance.
   * @param namespace The namespace for this logger instance (e.g., the module name).
   * @param baseTags An optional array of tags to apply to all messages from this logger.
   */
  constructor(namespace: string, baseTags: string[] = []) {    
    this._namespace = camelToLowerUnderscore(namespace);
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
        BaseLogger._levelMap[logMessage.level](output);
    } catch(err) {
        // If formatting fails, log a raw error to avoid losing the original message entirely.
        console.error("--- LOGGER FORMATTING ERROR ---", err, "--- ORIGINAL MESSAGE ---", logMessage);
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

            const result = Array.isArray(val) ? [] : {};
            for (const key in val) {
                if (Object.prototype.hasOwnProperty.call(val, key)) {
                    (result as Record<string, any>)[key] = recurse(val[key]);
                }
            }
            // Return the object with its children transformed first.
            // Then, check if any transformer wants to transform the object itself.
            const objTransformer = sortedTransformers.find(t => t.canTransform(result));
            return objTransformer ? objTransformer.transform(result) : result;
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
