import { type JsonValue, type Serializable } from "../core/types.js";

function isSerializable(value: unknown): value is Serializable {
  return typeof value === 'object' && value !== null && 'serialize' in value && typeof (value as Serializable).serialize === 'function';
}

/**
 * Recursively serializes a value into a JSON-compatible format.
 * - Handles scalars, Dates, Arrays, and plain objects.
 * - Respects a .serialize() method on custom classes that implement Serializable.
 *
 * @param value The value to serialize.
 * @returns A JSON-compatible value.
 */
export function serialize(value: unknown): JsonValue {
  if (value === null || typeof value !== 'object') {
    return value as JsonValue;
  }
  if (isSerializable(value)) {
    return serialize(value.serialize());
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(item => serialize(item));
  }

  const obj: { [key: string]: JsonValue } = {};
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      obj[key] = serialize((value as Record<string, unknown>)[key]);
    }
  }
  return obj;
}