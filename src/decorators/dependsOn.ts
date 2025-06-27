/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseModule } from "../core/baseModule";

interface Dependency { module?: string; action?: string }
type Dependencies = Dependency[];

// Type-safe constructor reference
type ModuleConstructor<T extends BaseModule = BaseModule> = new (...args: any[]) => T;

// Type-safe overloads only
export function dependsOn<T extends BaseModule>(
  actionName: keyof T,
  moduleClass: ModuleConstructor<T>
): any;
export function dependsOn(actionName: string): any; // Same-module dependency (no slash required)
export function dependsOn<T extends BaseModule>(
  actionName: keyof T | string,
  moduleClass?: ModuleConstructor<T>
) {
  return (
    target: any,
    context: ClassMethodDecoratorContext | ClassDecoratorContext,
  ) => {
    let deps: Dependencies;

    if (moduleClass && typeof actionName === "string") {
      // Type-safe cross-module dependency: @dependsOn("init", TestModuleB)
      deps = [{
        module: moduleClass.name,
        action: actionName
      }];
    } else if (typeof actionName === "string" && !moduleClass) {
      // Same-module dependency: @dependsOn("actionName") - clean and simple!
      deps = [{
        module: undefined,
        action: actionName
      }];
    } else {
      throw new Error(
        `Invalid @dependsOn usage. Use either:\n` +
        `- @dependsOn("actionName", ModuleClass) for cross-module dependencies\n` +
        `- @dependsOn("actionName") for same-module dependencies`
      );
    }

    context.addInitializer(function () {
      if (context.kind !== "method") return;
      target.dependsOn = deps.map((dep) => {
        if (!dep.module) {
          dep.module = (this as BaseModule).constructor.name;
        }
        return `${dep.module}${dep.action ? "/" + dep.action : ""}`;
      });
    });
  };
}
