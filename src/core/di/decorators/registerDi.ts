import { BaseDi, type BaseDiWrapper, BaseInitializer } from "../baseDi.js";
import { BaseError } from "../../baseErrors.js";

export interface RegisterOptions {
  key?: string;
  singleton?: boolean;
  phase?: number;
  setup?: boolean;
  teardown?: boolean;
  tags?: string[];
}

export function registerDi<T = unknown>(
  keyOrOptions?: string | RegisterOptions
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: new (...args: any[]) => T, context: ClassDecoratorContext) {
    let options: RegisterOptions;
    if (typeof keyOrOptions === "string") {
      options = { key: keyOrOptions };
    } else {
      options = keyOrOptions ?? {};
    }

    // Validate that phase can only be used with singletons
    if (options.phase !== undefined && options.singleton !== true) {
      throw new BaseError(
        `Configuration Error: The class '${context.name}' was registered with 'phase: ${options.phase}' but 'singleton' is not set to true. Phase ordering only makes sense for singleton services that are initialized during startup.`
      );
    }

    const wrapper: Partial<BaseDiWrapper<T>> = {
      key: options.key ?? target.name,
      singleton: options.singleton ?? false,
      type: "constructor",
      phase: options.phase ?? 100,
      tags: new Set<string>(options.tags ?? []),
    };
    BaseDi.register(target, wrapper);
    
    if (options.setup === true) {
      // Validate that setup requires singleton: true
      if (options.singleton !== true) {
        throw new BaseError(
          `Configuration Error: The class '${context.name}' was registered with 'setup: true' but 'singleton' is not set to true. Setup/teardown only works with singleton: true services.`
        );
      }
      
      // Note: setup method is now optional - if it doesn't exist, we'll use delay() as no-op
      BaseInitializer.register(context.name as string, options.phase ?? 100);
    }
    
    if (options.teardown === true) {
      // Validate that teardown requires singleton: true
      if (options.singleton !== true) {
        throw new BaseError(
          `Configuration Error: The class '${context.name}' was registered with 'teardown: true' but 'singleton' is not set to true. Setup/teardown only works with singleton: true services.`
        );
      }
      
      // Note: teardown method is now optional - if it doesn't exist, we'll use delay() as no-op
    }
  };
}