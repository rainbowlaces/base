export interface LogError {
  message: string;
  stack?: string[];
}

export type Scalar = string | number | boolean | null | undefined;

export type TypeSerializerConfig = Record<string, unknown>;

export interface TypeSerializer<T> {
  canSerialize(input: unknown): input is T;
  serialize(input: T): unknown;
}

export type LogContext = Record<string, unknown>;

export type PatternMap = Record<string, RegExp>;

export type PatternList = RegExp[];

export type SerializedLogContextData = Record<string, unknown>;

/**
 * Represents a serialized log message.
 */
export interface SerializedLogMessage {
  timestamp: string;
  level: string;
  namespace: string;
  message: string;
  tags: string[];
  context: LogContext;
}

export enum LogLevel {
  fatal = 1,
  error = 2,
  warning = 4,
  info = 8,
  debug = 16,
}

export type LoggerFunction = (message: unknown, tags?: string[]) => void;

export type LogFormatter = (message: SerializedLogMessage) => string;
