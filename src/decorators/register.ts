import { BaseDi } from "../core/baseDi";
import { type BaseDiWrapper } from "../core/types";

// Options for class registration - mirrors BaseDi.register wrapper options
export interface RegisterOptions {
  key?: string;
  singleton?: boolean;
}

/**
 * Class registration decorator - mirrors BaseDi.register API
 * 
 * Usage:
 * @register() - Register class with default settings (class name as key, not singleton)
 * @register("customKey") - Register with custom key
 * @register({ key: "customKey", singleton: true }) - Full options
 */
export function register<T = unknown>(
  keyOrOptions?: string | RegisterOptions
) {
  return function (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    target: new (...args: any[]) => T, 
    context: ClassDecoratorContext
  ) {
    // TypeScript ensures this is a class decorator, but keep for runtime safety
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (context.kind !== "class") {
      throw new Error("@register can only be used on classes");
    }

    let options: RegisterOptions;
    
    if (typeof keyOrOptions === "string") {
      // Shorthand: @register("customKey")
      options = { key: keyOrOptions };
    } else {
      // Full options or undefined: @register() or @register({ ... })
      options = keyOrOptions ?? {};
    }

    // Create wrapper that mirrors BaseDi.register behavior
    const wrapper: Partial<BaseDiWrapper<T>> = {
      key: options.key ?? target.name,
      singleton: options.singleton ?? false,
      type: "constructor"
    };

    BaseDi.register(target, wrapper);
  };
}
