import { LogContext, LogLevel } from "./types";

/**
 * Represents a log message.
 */
export class LogMessage {
  /**
   * The default log level.
   */
  static default: LogLevel = LogLevel.DEBUG;

  private _namespace: string;
  private _message: string;
  private _tags: Array<string>;
  private _level: LogLevel;
  private _context: LogContext;
  private _timestamp: string = new Date().toISOString();

  /**
   * Gets the log message.
   */
  get message(): string {
    return this._message;
  }

  /**
   * Gets the tags associated with the log message.
   */
  get tags(): Array<string> {
    return this._tags;
  }

  /**
   * Gets the log level as a string.
   */
  get level(): string {
    return LogLevel[this._level];
  }

  /**
   * Gets the timestamp of the log message.
   */
  get timestamp(): string {
    return this._timestamp;
  }

  /**
   * Gets the namespace of the log message.
   */
  get namespace(): string {
    return this._namespace;
  }

  /**
   * Gets the context of the log message.
   */
  get context(): LogContext {
    return this._context;
  }

  /**
   * Creates a new LogMessage instance.
   *
   * @param message - The log message.
   * @param namespace - The namespace of the log message.
   * @param tags - An array of tags associated with the log message. (optional)
   * @param level - The log level of the message. (optional)
   * @param context - The log context.
   * @returns A new LogMessage instance.
   */
  static create(
    message: string,
    namespace: string,
    tags: Array<string> = [],
    level: LogLevel = LogMessage.default,
    context: LogContext,
  ): LogMessage {
    return new LogMessage(message, namespace, tags, level, context);
  }

  /**
   * Represents a log message.
   * @param message - The log message.
   * @param namespace - The namespace of the log message.
   * @param tags - The tags associated with the log message.
   * @param level - The log level of the message.
   * @param context - The context of the log message.
   */
  constructor(
    message: string,
    namespace: string,
    tags: Array<string> = [],
    level: LogLevel = LogMessage.default,
    context: LogContext,
  ) {
    this._message = message;
    this._tags = tags;
    this._namespace = namespace;
    this._level = level;
    this._context = context;
  }
}
