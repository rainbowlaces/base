import { BaseDi } from "../baseDi";

export function di<T = unknown>(
  keyOrClass: string | (new (...args: never[]) => T),
  ...args: unknown[]
) {
  return function (
    _target: unknown, 
    context: ClassAccessorDecoratorContext
  ) {

    let resolveKey: string;
    let injectionArgs: unknown[] = args;
    
    if (typeof keyOrClass === "function") {
      resolveKey = keyOrClass.name;
      injectionArgs = args;
    } else {
      resolveKey = keyOrClass;
    }

    let cached: T | undefined;
    let resolved = false;

    return {
      get(): T {
        if (!resolved) {
          cached = BaseDi.resolve<T>(resolveKey, ...injectionArgs);
          resolved = true;
        }
        return cached as T;
      },
      set(): void {
        throw new Error(
          `Cannot assign to dependency-injected property '${String(context.name)}'.`,
        );
      },
    };
  };
}