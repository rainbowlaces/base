import { BaseDi } from "../core/baseDi";

/**
 * Property injection decorator - mirrors BaseDi.resolve API
 * 
 * Usage:
 * @di<MyService>(MyService, ...args) - Type-safe injection using constructor with arguments
 * @di<MyType>("myKey", ...args) - String-based injection
 */
export function di<T = unknown>(
  keyOrClass: string | (new (...args: never[]) => T),
  ...args: unknown[]
) {
  return function (
    _target: unknown, 
    context: ClassAccessorDecoratorContext
  ) {
    // TypeScript ensures this is an accessor decorator, but keep for runtime safety
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (context.kind !== "accessor") {
      throw new Error("@di can only be used on accessor properties");
    }
    
    let resolveKey: string;
    let injectionArgs: unknown[] = args;
    
    // Determine resolution strategy
    if (typeof keyOrClass === "function") {
      // Constructor-based injection: @di(MyService, ...args)
      resolveKey = keyOrClass.name;
      // Keep the args for constructor-based injection
      injectionArgs = args;
    } else {
      // String-based injection: @di<MyType>("myKey", ...args)
      resolveKey = keyOrClass;
    }

    return {
      get(): T {
        const val = BaseDi.create().resolve<T>(resolveKey, ...injectionArgs);
        
        // Fail loudly instead of returning null
        if (val === null || val === undefined) {
          throw new Error(
            `Dependency injection failed: Could not resolve '${resolveKey}'. ` +
            `Make sure the service is registered with @register() on the class.`
          );
        }
        
        return val;
      },
      set(): void {
        throw new Error(
          `Cannot assign to dependency-injected property '${String(context.name)}'.`,
        );
      },
    };
  };
}
