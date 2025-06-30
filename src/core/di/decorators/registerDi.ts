import { BaseDi, type BaseDiWrapper, BaseInitializer } from "../baseDi";

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

    const wrapper: Partial<BaseDiWrapper<T>> = {
      key: options.key ?? target.name,
      singleton: options.singleton ?? false,
      type: "constructor",
      phase: options.phase ?? 100,
      tags: new Set<string>(options.tags ?? []),
    };
    BaseDi.register(target, wrapper);
    
    if (options.setup === true) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (typeof (target.prototype).setup !== "function") {
        throw new Error(
          `Configuration Error: The class '${context.name}' was registered with 'setup: true' but does not have a 'setup(): Promise<void>' method.`
        );
      }
      BaseInitializer.register(context.name as string, options.phase ?? 100);
    }
    
    if (options.teardown === true) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof (target.prototype).teardown !== 'function') {
          throw new Error(
            `Configuration Error: The class '${context.name}' was registered with 'teardown: true' but does not have a 'teardown(): Promise<void>' method.`
          );
        }
    }
  };
}