import { type Scalar } from "../types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T> = new (...args: any[]) => T;

export type Instance<T> = T;

export interface DiSetup {
  setup(): Promise<void>;
}

export interface DiTeardown {
  teardown(): Promise<void>;
}

export interface BaseDiWrapper<T> {
  singleton?: boolean;
  key?: string;
  tags?: Set<string>;
  type?: "constructor" | "instance" | "scalar";
  value?: Constructor<T> | Instance<T> | Scalar;
  phase?: number;
}