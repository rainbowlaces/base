// Logger types and enums

export enum LogLevel {
  FATAL = 1,
  ERROR = 2,
  WARNING = 4,
  INFO = 8,
  DEBUG = 16,
  TRACE = 32,
}

export type LogContext = Record<string, unknown>;

export interface LogError {
  message: string;
  stack?: string | string[];  // Can be string or string array
  [key: string]: unknown;
}

export interface SerializedLogMessage {
  timestamp: string;  // ISO date string, not number
  namespace: string;
  level: string;      // String representation of LogLevel
  message: string;
  tags: string[];
  context: LogContext;
}

export type LoggerFunction = (message: unknown, tags?: string[]) => void;

export type LogFormatter = (message: SerializedLogMessage) => string;

export type TypeSerializerConfig = Record<string, unknown>;

export interface TypeSerializer<T = unknown> {
  canSerialize(value: unknown): boolean;
  serialize(value: T, config?: TypeSerializerConfig): unknown;
}

export type PatternMap = Record<string, string | RegExp>;

export type Scalar = string | number | boolean | null | undefined;
