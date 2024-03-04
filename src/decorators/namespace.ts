import BaseModule from "../core/baseModule";
import { isLowerUnderscore } from "../utils/string";

/**
 * Optionally assigns a specific namespace to a class, typically used to define a unique configuration
 * and logging scope for modules. If a module does not use the @namespace decorator, the default namespace
 * is derived from the class name, transformed to lower underscore case using the module's name. This ensures
 * that each module has a distinct namespace for its configuration and logs, promoting a structured and
 * organized approach to managing module-specific settings and log output.
 */
export default function namespace(ns: string) {
  return function (target: BaseModule, { kind }: ClassDecoratorContext) {
    if (kind !== "class") return;

    const nsLower: string = ns.toLowerCase();

    if (!isLowerUnderscore(nsLower)) {
      throw new Error(`Namespace must_be_underscored, but got: ${ns}`);
    }

    //@ts-expect-error setting the namespace of this class.
    target._namespace = nsLower;
    return target;
  };
}
