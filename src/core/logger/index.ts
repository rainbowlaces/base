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
import { delay } from "../../utils/async";

type LoggerMap = Record<string, LoggerFunction>;

type LoggerConfig = {
  maxInFlightLogs?: number;
  logLevel?: LogLevel;
  logFormatter?: LogFormatter;
  logSerialiser?: LogMessageSerializer;
  logRedactor?: LogMessageRedactor;
  redaction?: boolean;
  async?: boolean;
} & LogMessageSerializerConfig &
  LogMessageRedactorConfig;

/**
 * Represents a logger that can be used to log messages with different log levels.
 */
export default class BaseLogger {
  private static _logEmitter: EventEmitter = new EventEmitter();
  private static _inFlightLogs: number;
  private static _logLimitOverflow: boolean;

  private static formatter: LogFormatter = (message: SerializedLogMessage) => {
    const seen = new WeakSet();
    return JSON.stringify(message, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }
      return value;
    });
  };

  private _baseTags: Array<string> = [];
  private _namespace: string;

  private static serializer: LogMessageSerializer;
  private static redactor: LogMessageRedactor;

  private static _config: LoggerConfig;

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
    BaseLogger._config = {
      logLevel: LogLevel.DEBUG,
      maxInFlightLogs: 1000,
      redaction: true,
      logFormatter: BaseLogger.formatter,
      logSerialiser: new DefaultLogMessageSerializer(),
      logRedactor: new DefaultLogMessageRedactor(),
      async: false,
      ...config,
    };

    BaseLogger.formatter =
      BaseLogger._config.logFormatter || BaseLogger.formatter;
    BaseLogger.serializer =
      BaseLogger._config.logSerialiser || new DefaultLogMessageSerializer();
    BaseLogger.redactor =
      BaseLogger._config.logRedactor || new DefaultLogMessageRedactor();

    BaseLogger.serializer.init(BaseLogger._config);
    BaseLogger.redactor.init(BaseLogger._config);

    BaseLogger._inFlightLogs = 0;
    BaseLogger._logLimitOverflow = false;
    BaseLogger._logEmitter.removeAllListeners();

    BaseLogger._logEmitter.on("log", (logMessage: SerializedLogMessage) => {
      BaseLogger._inFlightLogs -= 1;
      BaseLogger.outputLogMessage(logMessage);
    });

    BaseLogger._logEmitter.on("error", (error: Error) => {
      BaseLogger.handleInternalError(error);
    });
  }

  private static handleInternalError(error: Error, context: LogContext = {}) {
    BaseLogger._levels["ERROR"](
      BaseLogger.formatter({
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
        out = BaseLogger.serializer.serialize(out);
        if (BaseLogger._config.redaction) {
          out = BaseLogger.redactor.redact(out);
        }
      }
      BaseLogger._levels[out.level](BaseLogger.formatter(out));
      if (out.level === "FATAL") {
        // eslint-disable-next-line no-process-exit
        process.exit(1);
      }
    } catch (error) {
      BaseLogger.handleInternalError(error as Error);
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
    if (level > BaseLogger._config.logLevel!) return;

    const tags: Array<string> = [...this._baseTags, ...messageTags];

    if (level === LogLevel.FATAL) {
      return BaseLogger.outputLogMessage(
        LogMessage.create(message, this._namespace, tags, level, context),
      );
    }

    if (BaseLogger._config.async) await delay();

    // If the log buffer was overflowing but we are now within 90% of the maximum
    // we can reset the overflow flag.
    if (
      BaseLogger._logLimitOverflow &&
      BaseLogger._inFlightLogs < BaseLogger._config.maxInFlightLogs! * 0.9
    ) {
      BaseLogger._logLimitOverflow = false;
    }

    // If the log buffer is full, drop the message and immediately log an error.
    if (
      BaseLogger._logLimitOverflow ||
      BaseLogger._inFlightLogs > BaseLogger._config.maxInFlightLogs!
    ) {
      return BaseLogger.handleInternalError(
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
      serializedMessage = BaseLogger.serializer.serialize(logMessage);
      if (BaseLogger._config.redaction) {
        serializedMessage = BaseLogger.redactor.redact(serializedMessage);
      }
    } catch (error) {
      return BaseLogger.handleInternalError(error as Error, {
        message,
        tags,
        level: LogLevel[level],
        context,
      });
    }

    if (BaseLogger._config.async) {
      BaseLogger._logEmitter.emit("log", serializedMessage);
      BaseLogger._inFlightLogs += 1;
    } else {
      BaseLogger.outputLogMessage(serializedMessage);
    }
  }
}
