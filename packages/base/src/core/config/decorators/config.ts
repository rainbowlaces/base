import { Thunk } from "../../../utils/thunk.js";
import { BaseDi } from "../../di/baseDi.js";
import { type Constructor } from "../../di/types.js";
import { type BaseClassConfig } from "../types.js";
import { BaseError } from "../../baseErrors.js";

export function config<T extends BaseClassConfig = BaseClassConfig>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  targetClass: string | Constructor<any> | Thunk<Constructor<any>>)
 {
  return function (
    _target: unknown, 
    context: ClassAccessorDecoratorContext
  ) {
    
    if (targetClass instanceof Thunk) {
      targetClass = targetClass.resolve();
    } 
    const configKey = typeof targetClass === "string" ? `Config.${targetClass}` : `Config.${targetClass.name}`;

    return {
      get(): T {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targetClass = targetClass as Constructor<any>;
        try {
          return BaseDi.resolve<T>(configKey);
        }
        catch {
          return {} as T;
        }
      },
      set(): void {
        throw new BaseError(
          `Cannot assign to dependency-injected property '${String(context.name)}'.`,
        );
      },
    };
  };
}