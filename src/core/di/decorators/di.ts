import { BaseDi } from "../baseDi.js";
import { BaseError } from "../../baseErrors.js";

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

    return {
      get(): T {
        return BaseDi.resolve<T>(resolveKey, ...injectionArgs);
      },
      set(): void {
        throw new BaseError(
          `Cannot assign to dependency-injected property '${String(context.name)}'.`,
        );
      },
    };
  };
}