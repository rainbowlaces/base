/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseModule } from "../core/baseModule";

export function config<T>(
  mapping?: string,
): (value: unknown, context: ClassFieldDecoratorContext) => void {
  return (value: unknown, context: ClassFieldDecoratorContext): unknown => {
    if (context.kind !== "field") return;
    return function (this: BaseModule, initialValue: any): T {
      if (!this.config) return initialValue;
      const _map = mapping ?? context.name;
      const val: T = this.config.get<T>(_map as string, initialValue);
      return val;
    };
  };
}
