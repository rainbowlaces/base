/* eslint-disable @typescript-eslint/no-explicit-any */

import { type BaseModule } from "../baseModule";

interface Dependency { module?: string; action?: string }
type Dependencies = Dependency[];

// Type-safe constructor reference
type ModuleConstructor<T extends BaseModule = BaseModule> = new (...args: any[]) => T;

// Extract method names from a class type (excludes properties, getters, etc.)
type MethodNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

// Type-safe overloads
export function dependsOn<T extends BaseModule>(
  actionName: MethodNames<T>,
  moduleClass: ModuleConstructor<T>
): any;
export function dependsOn(actionName: string): any; // Same-module dependency
export function dependsOn<T extends BaseModule>(
  actionName: MethodNames<T> | string,
  moduleClass?: ModuleConstructor<T>
) {
  return (
    target: any,
    context: ClassMethodDecoratorContext | ClassDecoratorContext,
  ) => {
    let deps: Dependencies;

    if (moduleClass && typeof actionName === "string") {
      // Type-safe cross-module dependency: @dependsOn("init", TestModuleB)
      // Now actionName is constrained to be a method name of T
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      target.dependsOn = deps.map((dep) => {
        // For cross-module dependencies, dep.module is already set to the target module name
        // For same-module dependencies, use the current module name
        const moduleName = dep.module ?? (this as BaseModule).constructor.name;
        return `${moduleName}${dep.action ? "/" + dep.action : ""}`;
      });
    });
  };
}
