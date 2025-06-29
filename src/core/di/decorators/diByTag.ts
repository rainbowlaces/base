import { BaseDi } from "../baseDi";

/**
 * Injects an array of dependencies that have been registered with a specific tag.
 */
export function diByTag<T = unknown>(tag: string) {
  return function (
    _target: unknown,
    context: ClassAccessorDecoratorContext
  ) {
    let instances: T[] | null = null;

    return {
      get(): T[] {
        instances ??= BaseDi.resolveByTag<T>(tag);
        return instances;
      },
      set(): void {
        throw new Error(
          `Cannot assign to dependency-injected property '${String(context.name)}'.`,
        );
      },
    };
  };
}