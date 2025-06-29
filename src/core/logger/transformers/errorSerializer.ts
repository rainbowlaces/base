import { logSerializer } from "../decorators/logSerializer";
import { type LogObjectTransformer } from "../types";

/**
 * A serializer plugin for Error objects.
 * It transforms an Error into a plain object with message and stack trace.
 */
@logSerializer()
export class ErrorSerializer implements LogObjectTransformer {
    readonly priority: number = 10;
  
    /**
   * Checks if the value is an instance of an Error.
   */
  public canTransform(value: unknown): value is Error {
    return value instanceof Error;
  }

  /**
   * Transforms an Error into a serializable object.
   */
  public transform(value: Error): unknown {
    const error = value;
    return {
      message: error.message,
      name: error.name,
      stack: error.stack
        ?.split("\n")
        .slice(1)
        .map((s) => s.trim()),
    };
  }
}