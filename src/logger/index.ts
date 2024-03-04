import { EventEmitter } from "events";
import {
  LogContext,
  LogFormatter,
  LogLevel,
  LoggerFunction,
  SerializedLogMessage,
} from "./types";
import { LogMessage } from "./logMessage";
import DefaultLogMessageRedactor, {
  LogMessageRedactor,
  LogMessageRedactorConfig,
} from "./logMessageRedactor";
import DefaultLogMessageSerializer, {
  LogMessageSerializer,
  LogMessageSerializerConfig,
} from "./logMessageSerializer";
import { delay } from "../utils/async";

type LoggerMap = Record<string, LoggerFunction>;

type LoggerConfig = {
  maxInFlightLogs?: number;
  logLevel?: LogLevel;
  logFormatter?: LogFormatter;
  logSerialiser?: LogMessageSerializer;
  logRedactor?: LogMessageRedactor;
  redaction?: boolean;
} & LogMessageSerializerConfig &
  LogMessageRedactorConfig;

/**
 * Represents a logger that can be used to log messages with different log levels.
 */
export default class Logger {
  private static _logEmitter: EventEmitter = new EventEmitter();
  private static _maxInFlightLogs: number;
  private static _inFlightLogs: number;
  private static _logLimitOverflow: boolean;
  private static _logLevel: LogLevel;
  private static _enableRedaction: boolean;

  private static _logFormatter: LogFormatter = (
    message: SerializedLogMessage,
  ) => JSON.stringify(message);

  private _baseTags: Array<string> = [];
  private _namespace: string;

  private static serializer: LogMessageSerializer;
  private static redactor: LogMessageRedactor;

  /**
   * Map of log levels to corresponding console functions.
   */
  private static _levels: LoggerMap = {
    [LogLevel[LogLevel.FATAL]]: console.error,
    [LogLevel[LogLevel.ERROR]]: console.error,
    [LogLevel[LogLevel.WARNING]]: console.warn,
    [LogLevel[LogLevel.INFO]]: console.log,
    [LogLevel[LogLevel.DEBUG]]: console.debug,
  };

  /**
   * Initializes the logger with the provided configuration.
   * @param config - The configuration options for the logger.
   */
  static init(config: LoggerConfig = {}) {
    Logger._maxInFlightLogs = config.maxInFlightLogs ?? 1000;
    Logger._logLevel = config.logLevel ?? LogLevel.DEBUG;
    Logger._inFlightLogs = 0;
    Logger._enableRedaction = config.redaction ?? true;
    Logger._logLimitOverflow = false;

    Logger._logEmitter.removeAllListeners();

    Logger._logFormatter = config.logFormatter || Logger._logFormatter;

    Logger.serializer =
      config.logSerialiser || new DefaultLogMessageSerializer();
    Logger.redactor = config.logRedactor || new DefaultLogMessageRedactor();

    Logger.serializer.init(config);
    Logger.redactor.init(config);

    Logger._logEmitter.on("log", (logMessage: SerializedLogMessage) => {
      Logger._inFlightLogs -= 1;
      Logger.outputLogMessage(logMessage);
    });

    Logger._logEmitter.on("error", (error: Error) => {
      Logger.handleInternalError(error);
    });
  }

  private static handleInternalError(error: Error, context: LogContext = {}) {
    Logger._levels["ERROR"](
      Logger._logFormatter({
        timestamp: new Date().toISOString(),
        level: "ERROR",
        namespace: "logger",
        message: `Error formatting log message: ${error.message}`,
        tags: [],
        context: { data: { ...context, stack: error.stack } },
      }),
    );
  }

  private static outputLogMessage(
    logMessage: SerializedLogMessage | LogMessage,
  ) {
    let out: SerializedLogMessage | LogMessage = logMessage;

    try {
      if (out instanceof LogMessage) {
        out = Logger.serializer.serialize(out);
        if (Logger._enableRedaction) {
          out = Logger.redactor.redact(out);
        }
      }
      Logger._levels[out.level](Logger._logFormatter(out));
    } catch (error) {
      Logger.handleInternalError(error as Error);
    }
  }

  /**
   * Creates a new instance of the Logger class.
   * @param namespace - The namespace for the logger.
   * @param baseTags - An optional array of base tags for the logger.
   */
  constructor(namespace: string, baseTags: Array<string> = []) {
    this._namespace = namespace;
    this._baseTags = baseTags;
  }

  /**
   * Logs a fatal error message with optional tags.
   * @param message - The error message to log.
   * @param tags - Optional tags to associate with the error.
   */
  fatal(message: string, tags: Array<string> = [], context?: LogContext) {
    this.log(message, tags, LogLevel.FATAL, context);
  }

  /**
   * Logs an error message with optional tags.
   * @param message - The error message to log.
   * @param tags - Optional tags to associate with the error.
   */
  /**
   * Logs an error message with optional tags.
   * @param message - The error message to log.
   * @param tags - Optional tags to associate with the error.
   * @param context - Optional context data to include in the log message.
   */
  error(
    message: string | Error,
    tags: Array<string> = [],
    context?: LogContext,
  ) {
    if (message instanceof Error) {
      this.log(message.message, tags, LogLevel.ERROR, {
        error: message,
        ...context,
      });
    } else {
      this.log(message, tags, LogLevel.ERROR, context);
    }
  }

  /**
   * Logs a warning message with optional tags.
   *
   * @param message - The warning message to log.
   * @param tags - Optional tags to associate with the warning.
   */
  warn(message: string, tags: Array<string> = [], context?: LogContext) {
    this.log(message, tags, LogLevel.WARNING, context);
  }

  /**
   * Logs a debug message with optional tags.
   *
   * @param message - The debug message to log.
   * @param tags - Optional tags to associate with the debug message.
   */
  debug(message: string, tags: Array<string> = [], context?: LogContext) {
    this.log(message, tags, LogLevel.DEBUG, context);
  }

  /**
   * Logs an informational message with optional tags.
   * @param message - The message to be logged.
   * @param tags - Optional tags to categorize the log message.
   */
  info(message: string, tags: Array<string> = [], context?: LogContext) {
    this.log(message, tags, LogLevel.INFO, context);
  }

  /**
   * Logs a message with optional tags, level, and context.
   * If the log level is higher than the current log level, the message is dropped.
   * If the log buffer is full, the message is dropped and an error is logged.
   * @param message - The message to be logged.
   * @param messageTags - Optional array of tags associated with the message.
   * @param level - Optional log level. Defaults to LogMessage.default.
   * @param context - Optional log context.
   * @returns A promise that resolves when the log message is processed.
   */
  async log(
    message: string,
    messageTags: Array<string> = [],
    level: LogLevel = LogMessage.default,
    context: LogContext = {},
  ) {
    // If the log level is higher than the current log level, drop the message.
    if (level > Logger._logLevel) return;

    await delay();

    const tags: Array<string> = [...this._baseTags, ...messageTags];

    // If the log buffer was overflowing but we are now within 90% of the maximum
    // we can reset the overflow flag.
    if (
      Logger._logLimitOverflow &&
      Logger._inFlightLogs < Logger._maxInFlightLogs * 0.9
    ) {
      Logger._logLimitOverflow = false;
    }

    // If the log buffer is full, drop the message and immediately log an error.
    if (
      Logger._logLimitOverflow ||
      Logger._inFlightLogs > Logger._maxInFlightLogs
    ) {
      return Logger.handleInternalError(
        new Error("Log queue full. Message dropped."),
        { message, tags, level: LogLevel[level], context },
      );
    }

    const logMessage = LogMessage.create(
      message,
      this._namespace,
      tags,
      level,
      context as LogContext,
    );

    let serializedMessage;
    try {
      serializedMessage = Logger.serializer.serialize(logMessage);
      if (Logger._enableRedaction) {
        serializedMessage = Logger.redactor.redact(serializedMessage);
      }
    } catch (error) {
      return Logger.handleInternalError(error as Error, {
        message,
        tags,
        level: LogLevel[level],
        context,
      });
    }

    // Serialize the log message.
    // Emit the log event.
    Logger._logEmitter.emit("log", serializedMessage);

    // Increment the in-flight log count.
    Logger._inFlightLogs += 1;
  }
}
