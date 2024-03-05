import {
  GetTransformerFunction,
  TransformFunction,
  recursiveMap,
} from "../utils/recursion";
import { PatternMap, LogContext, SerializedLogMessage } from "./types";

export type LogMessageRedactorConfig = {
  patterns?: PatternMap;
};

export interface LogMessageRedactor {
  init(config: LogMessageRedactorConfig): void;
  redact(logMessage: SerializedLogMessage): SerializedLogMessage;
}

/**
 * Class responsible for redacting sensitive information from log messages.
 */
export default class LogMessageRedactorDefault implements LogMessageRedactor {
  private patterns: PatternMap = {
    email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/,
    credit_card:
      /[3456]\d{3}([. -]?)((\d{4}\1\d{4}\1\d{4}(\1\d{1,3})?)|(\d{6}\1\d{4,5}))/,
    zip_code: /\b\d{5}(-\d{4})?\b/,
    phone_number:
      /(((\+|00)(?:[ .-])?\d{1,3}[ .-]?\(?\d?\)?[ .-]?)|\(?0\)?)([ .-]?\d{2,8}){3,5}/,
    ssn: /(?!000|666|9\d{2})(\d{3})((-| )?)(?!00)\d{2}\2(?!0000)\d{4}/,
    ip4_address: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
    ip6_address:
      /(?!::(?:0{1,4}:){0,5}?0{1,4}(?:0{1,3})?$|::1$)([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4})/,
    ni_number: /[A-Z]{2}([ -]?)(\d{2}\1?){3}[A-Z]/,
    uk_post_code:
      /(([A-Z]{1,2}\d{1,2}[A-Z]?|GIR)\s?\d{1}[A-Z]{2})|BFPO\s?\d{1,3}/,
  };

  init(config: LogMessageRedactorConfig): void {
    this.patterns = { ...config.patterns, ...this.patterns };
    Object.keys(this.patterns).forEach(
      (key) =>
        (this.patterns[key] = new RegExp(this.patterns[key].source, "gu")),
    );
  }

  public redact(serializedMessage: SerializedLogMessage): SerializedLogMessage {
    return {
      ...serializedMessage,
      message: this.redactValue(serializedMessage.message) as string,
      context: this.redactContext(serializedMessage.context),
    };
  }

  private redactValue(value: string): string {
    return Object.entries(this.patterns).reduce(
      (redactedValue, [name, pattern]) =>
        redactedValue.replace(pattern, `[${name}]`),
      value,
    );
  }

  private redactContext(context: LogContext): LogContext {
    // Use recursiveMap for deep redaction, applying redactValue to all scalar values

    const getTransformer: GetTransformerFunction = (value: unknown) => {
      if (typeof value === "string") {
        return this.redactValue.bind(this) as TransformFunction;
      }
      return null;
    };

    return recursiveMap(
      context,
      {
        maxDepth: Infinity,
      },
      getTransformer,
    ) as LogContext;
  }
}
