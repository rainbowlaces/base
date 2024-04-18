/* eslint-disable @typescript-eslint/no-explicit-any */

import BaseModule from "../core/baseModule";

type Dependency = { module?: string; action?: string };
type Dependencies = Dependency[];

function validateDependencies(deps: string[]): Dependencies {
  const dependencyRegex = /^([^/]*)(\/.*)?$/;
  const parsedDeps = [];

  for (const dep of deps) {
    const match = dep.match(dependencyRegex);
    if (!match) {
      throw new Error(`Invalid dependency: ${dep}`);
    }

    const [, module, action] = match;
    const newDep = {
      module: module || undefined,
      action: action ? action.slice(1) : undefined, // remove the leading slash
    };

    parsedDeps.push(newDep);
  }

  return parsedDeps;
}

export default function dependsOn(dependencies: string | string[]) {
  return (
    target: any,
    context: ClassMethodDecoratorContext | ClassDecoratorContext,
  ) => {
    const deps: Dependencies = validateDependencies(
      Array.isArray(dependencies) ? dependencies : [dependencies],
    );

    context.addInitializer(function () {
      if (!["class", "method"].includes(context.kind)) return;
      if (context.kind === "method") {
        target.dependsOn = deps.map((dep) => {
          if (!dep.module) {
            dep.module = (this as BaseModule).constructor.name;
          }
          if (!dep.action) {
            throw new Error(
              `Action dependency must specify action. ${dep.module}/${dep.action}`,
            );
          }
          return `${dep.module}/${dep.action}`;
        });
      }
      if (context.kind === "class") {
        target.dependsOn = deps.map((dep) => {
          if (!dep.module) {
            throw new Error("Module dependency must specify module.");
          }
          if (dep.action) {
            throw new Error("Module dependency can not specify action.");
          }
          return `${dep.module}`;
        });
      }
    });
  };
}
