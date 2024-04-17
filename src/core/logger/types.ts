export type LogError = {
  message: string;
  stack?: string[];
};

export type Scalar = string | number | boolean | null | undefined;

export type TypeSerializerConfig = Record<string, unknown>;

export interface TypeSerializer<T> {
  canSerialize(input: unknown): input is T;
  serialize(input: T): unknown;
}

export type LogContext = Record<string, unknown>;

export type PatternMap = Record<string, RegExp>;

export type PatternList = Array<RegExp>;

export type SerializedLogContextData = Record<string, unknown>;

/**
 * Represents a serialized log message.
 */
export type SerializedLogMessage = {
  timestamp: string;
  level: string;
  namespace: string;
  message: string;
  tags: Array<string>;
  context: LogContext;
};

export enum LogLevel {
  FATAL = 1,
  ERROR = 2,
  WARNING = 4,
  INFO = 8,
  DEBUG = 16,
}

export type LoggerFunction = (message: unknown, tags?: Array<string>) => void;

export type LogFormatter = (message: SerializedLogMessage) => string;
