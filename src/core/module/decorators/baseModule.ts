import { registerDi } from "../../di/decorators/registerDi";
import { type BaseModule } from "../baseModule";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function baseModule<T extends new () => BaseModule<any>>(
  target: T,
  context: ClassDecoratorContext
): T {
  registerDi({
    singleton: true,
    setup: true,
    teardown: true,
    phase: 90,
    tags: ["Module"],
  })(target, context);
  return target;
}
