import { LogMessage } from "./logMessage.js";
import {
  type LogContext,
  LogLevel,
  type SerializedLogMessage,
  type LoggerConfig,
  type LogObjectTransformer,
} from "./types.js";
import { camelToLowerUnderscore } from "../../utils/string.js";
import { NodeConsole, type Console } from "../../utils/console.js";
import { registerDi } from "../di/decorators/registerDi.js";
import { diByTag } from "../di/baseDi.js";
import { config } from "../config/decorators/config.js";

/**
 * BaseLogger provides a flexible, testable logging solution.
 */
@registerDi()
export class BaseLogger {
  // --- Private Properties ---

  readonly namespace: string;
  readonly baseTags: string[];
  readonly #console: Console;

  @config<LoggerConfig>("BaseLogger")
  private accessor config!: LoggerConfig;

  @diByTag("Logger:Serializer")
  private accessor serializers!: LogObjectTransformer[];

  @diByTag("Logger:Redactor")
  private accessor redactors!: LogObjectTransformer[];

  /**
   * Get the console method for a specific log level.
   */
  private _getConsoleMethod(
    level: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): (message?: any, ...optionalParams: any[]) => void {
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
   * @param baseTags An optional array of tags to apply to all messages from this logger.
   * @param console Optional console implementation for testing.
   */
  constructor(
    namespace: string,
    baseTags: string[] = [],
    console: Console = new NodeConsole()
  ) {
    this.namespace = camelToLowerUnderscore(namespace);
    this.baseTags = baseTags;
    this.#console = console;
  }

  // --- Public Logging API ---

  public fatal(
    message: string,
    tags: string[] = [],
    context?: LogContext
  ): void {
    this.log(message, tags, LogLevel.FATAL, context);
  }

  public error(
    message: string | Error,
    tags: string[] = [],
    context: LogContext = {}
  ): void {
    if (message instanceof Error) {
      this.log(message.message, tags, LogLevel.ERROR, {
        error: message,
        ...context,
      });
    } else {
      this.log(message, tags, LogLevel.ERROR, context);
    }
  }

  public warn(
    message: string,
    tags: string[] = [],
    context?: LogContext
  ): void {
    this.log(message, tags, LogLevel.WARNING, context);
  }

  public info(
    message: string,
    tags: string[] = [],
    context?: LogContext
  ): void {
    this.log(message, tags, LogLevel.INFO, context);
  }

  public debug(
    message: string,
    tags: string[] = [],
    context?: LogContext
  ): void {
    this.log(message, tags, LogLevel.DEBUG, context);
  }

  public trace(
    message: string,
    tags: string[] = [],
    context?: LogContext
  ): void {
    this.log(message, tags, LogLevel.TRACE, context);
  }

  public log(
    message: string,
    tags: string[] = [],
    level: LogLevel = LogLevel.INFO,
    context: LogContext = {}
  ): void {
    if (!(level <= this.config.logLevel)) {
      return;
    }

    const logMessage = new LogMessage(
      message,
      this.namespace,
      [...this.baseTags, ...tags],
      level,
      context
    );

    try {
      const output = this._format(logMessage);
      const consoleMethod = this._getConsoleMethod(logMessage.level);
      consoleMethod(output);
    } catch (err) {
      // If formatting fails, log a raw error to avoid losing the original message entirely.
      this.#console.error(
        "--- LOGGER FORMATTING ERROR ---",
        err,
        "--- ORIGINAL MESSAGE ---",
        logMessage
      );
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
       
      context: this._applyTransformers(logMessage.context, this.serializers),
    };

    // Stage 2: Redact the entire plain object if redaction is enabled.
     
    const redacted =
      this.config.redaction
        ? this._applyTransformers(serializable, this.redactors)
        : serializable;

    // Stage 3: Convert the final, safe object to a JSON string.
    return JSON.stringify(redacted, (_key, value: unknown) => {
      if (typeof value === "bigint") {
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
  private _applyTransformers(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
    transformers: LogObjectTransformer[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    const sortedTransformers = [...transformers].sort(
      (a, b) => a.priority - b.priority
    );
    const seen = new WeakSet<object>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recurse = (val: any): any => {
      // Find the highest-priority transformer that can handle the current value.
      const transformer = sortedTransformers.find((t) => t.canTransform(val));

      // If a transformer is found, use it and STOP.
      // We don't recurse into the *result* of a transformation,
      // as that could cause unpredictable behavior.
      if (transformer) {
        return transformer.transform(val);
      }

      // If no transformer is found, and it's an object, we recurse into its children.
      if (typeof val === "object" && val !== null) {
         
        if (seen.has(val)) {
          return "[CircularReference]";
        }
         
        seen.add(val);

        const result: Record<string, unknown> | unknown[] = Array.isArray(val)
          ? []
          : {};
        for (const key in val) {
          if (Object.prototype.hasOwnProperty.call(val, key)) {
            const newKey = Array.isArray(result) ? parseInt(key, 10) : key;
             
            result[newKey as keyof typeof result] = recurse(
              (val as Record<string, unknown>)[key]
            );
          }
        }
        return result;
      }

      // If it's a primitive with no transformer, return it as is.
      return val;
    };

    return recurse(value);
  }
}
