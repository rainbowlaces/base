import { registerDi } from "../../di/decorators/registerDi.js";
import { type BaseModule } from "../baseModule.js";

interface BaseModuleOptions {
  phase?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function baseModule<T extends new () => BaseModule<any>>(
  options: BaseModuleOptions = {}
) {
  return function (target: T, context: ClassDecoratorContext): T {
    const { phase = 100 } = options;

    if (phase <= 50) throw new Error("Module phase must be greater than 50. Phases below 50 are reserved for core modules.");

    registerDi({
      key: target.name, // Use class name directly without Module. prefix
      singleton: true,
      setup: true,
      teardown: true,
      phase,
      tags: ["Module"],
    })(target, context);
    return target;
  };
}