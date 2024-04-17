export type Constructor<T> = new (...args: unknown[]) => T;
export type Scalar =
  | number
  | string
  | boolean
  | bigint
  | symbol
  | null
  | undefined;
export type Instance<T> = T;

export interface BaseDiWrapper<T> {
  singleton?: boolean;
  key?: string;
  type?: "constructor" | "instance" | "scalar";
  value?: Constructor<T> | Instance<T> | Scalar;
}
