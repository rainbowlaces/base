import { type LogContext, LogLevel } from "./types.js";
import { registerDi } from "../di/decorators/registerDi.js";

/**
 * Represents a log message.
 */
@registerDi()
export class LogMessage {
  /**
   * The default log level.
   */
  static default: LogLevel = LogLevel.DEBUG;

  #namespace: string;
  #message: string;
  #tags: string[];
  #level: LogLevel;
  #context: LogContext;
  #timestamp: string = new Date().toISOString();

  /**
   * Gets the log message.
   */
  get message(): string {
    return this.#message;
  }

  /**
   * Gets the tags associated with the log message.
   */
  get tags(): string[] {
    return this.#tags;
  }

  /**
   * Gets the log level as a string.
   */
  get level(): string {
    return LogLevel[this.#level];
  }

  /**
   * Gets the timestamp of the log message.
   */
  get timestamp(): string {
    return this.#timestamp;
  }

  /**
   * Gets the namespace of the log message.
   */
  get namespace(): string {
    return this.#namespace;
  }

  /**
   * Gets the context of the log message.
   */
  get context(): LogContext {
    return this.#context;
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
    tags: string[] = [],
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
    tags: string[] = [],
    level: LogLevel = LogMessage.default,
    context: LogContext,
  ) {
    this.#message = message;
    this.#tags = tags;
    this.#namespace = namespace;
    this.#level = level;
    this.#context = context;
  }
}
