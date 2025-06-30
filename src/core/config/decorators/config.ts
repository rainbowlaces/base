import { Thunk } from "../../../utils/thunk";
import { BaseDi, type Constructor } from "../../di/baseDi";
import { type BaseClassConfig } from "../types";

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
        throw new Error(
          `Cannot assign to dependency-injected property '${String(context.name)}'.`,
        );
      },
    };
  };
}