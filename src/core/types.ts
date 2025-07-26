export type MaybeAsync<T> = T | Promise<T>;

export type MaybeOptionalAsync<T> = T | Promise<T> | Promise<undefined> | undefined;

export type Scalar =
  | number
  | string
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [x: string]: JsonValue }
  | Array<JsonValue>;

export interface Serializable {
  serialize(): JsonValue;
}