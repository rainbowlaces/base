import { ConfigClassRegistry, type ConfigClassConstructor } from "../configClassRegistry.js";
import { Thunk } from "../../../utils/thunk.js";
import { type Constructor } from "../../di/types.js";

// Class decorator for configuration classes.
// Signature aligned with @config: accepts a string, a class constructor, or a Thunk wrapping a constructor.
export function configClass(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  targetClass: string | Constructor<any> | Thunk<Constructor<any>>
) {
  if (targetClass instanceof Thunk) {
    targetClass = targetClass.resolve();
  }
  const ns = typeof targetClass === "string" ? targetClass : targetClass.name;
  return function (target: ConfigClassConstructor, _context: ClassDecoratorContext) {
  ConfigClassRegistry.register(ns, target);
  };
}
