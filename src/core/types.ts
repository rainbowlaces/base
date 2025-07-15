export type MaybeAsync<T> = T | Promise<T>;

export type Scalar =
  | number
  | string
  | boolean
  | bigint
  | symbol
  | null
  | undefined;