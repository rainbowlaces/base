import { BaseDi } from "../baseDi.js";
import { BaseError } from "../../baseErrors.js";

/**
 * Injects an array of dependencies that have been registered with a specific tag.
 */
export function diByTag<T = unknown>(tag: string) {
  return function (
    _target: unknown,
    context: ClassAccessorDecoratorContext
  ) {
    return {
      get(): T[] {
        return BaseDi.resolveByTag<T>(tag);
      },
      set(): void {
        throw new BaseError(
          `Cannot assign to dependency-injected property '${String(context.name)}'.`,
        );
      },
    };
  };
}