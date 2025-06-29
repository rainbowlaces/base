import type { LogObjectTransformer } from "../types";

/**
 * Serializer for Error objects to ensure they are properly serialized to JSON.
 * Error objects have non-enumerable properties (message, name, stack) that don't
 * serialize properly with JSON.stringify() by default.
 */
export class ErrorSerializer implements LogObjectTransformer {
  public readonly priority = 1; // High priority to run early

  public canTransform(value: unknown): boolean {
    return value instanceof Error;
  }

  public transform(error: Error): Record<string, unknown> {
    return {
      // Include any enumerable properties first
      ...error,
      // Then override with non-enumerable properties
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
}
