/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { type BaseModule } from "../core/baseModule";

export function config<T>(
  mapping?: string,
): (_value: unknown, context: ClassFieldDecoratorContext) => void {
  return (_value: unknown, context: ClassFieldDecoratorContext): unknown => {
    return function (this: BaseModule, initialValue: any): T {
      const _map = mapping ?? context.name;
      const val: T = this.config.get<T>(_map as string, initialValue);
      return val;
    };
  };
}
