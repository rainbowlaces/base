import { registerDi } from "../../di/decorators/registerDi.js";
import { type BaseModule } from "../baseModule.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function baseModule<T extends new () => BaseModule<any>>(
  target: T,
  context: ClassDecoratorContext
): T {
  registerDi({
    key: target.name, // Use class name directly without Module. prefix
    singleton: true,
    setup: true,
    teardown: true,
    phase: 90,
    tags: ["Module"],
  })(target, context);
  return target;
}
