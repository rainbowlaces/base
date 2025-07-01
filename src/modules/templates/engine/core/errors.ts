import { BaseError } from "../../../../core/baseErrors";

/**
 * Template engine specific errors
 */
export class TemplateError extends BaseError {
  // Template error base class - inherits all BaseError functionality
}

/**
 * Thrown when template buffer exceeds the configured limit
 */
export class TemplateBufferExceededError extends TemplateError {
  constructor(currentSizeMB: number, limitMB: number) {
    super(`Template buffer exceeded limit: ${currentSizeMB}MB > ${limitMB}MB`);
  }
}

/**
 * Thrown when serializer registration fails in strict mode
 */
export class SerializerRegistrationError extends TemplateError {
  constructor(typeName: string) {
    super(`Duplicate serializer registration for type: ${typeName}`);
  }
}

/**
 * Thrown when validation fails
 */
export class TemplateValidationError extends TemplateError {
  constructor(message: string, cause?: unknown) {
    super(`Template validation failed: ${message}`, cause as Error);
  }
}
