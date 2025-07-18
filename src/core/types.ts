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