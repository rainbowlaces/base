/* eslint-disable @typescript-eslint/no-explicit-any */

import BaseModule from "../core/baseModule";

interface Dependency { module?: string; action?: string }
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
    if (!action) {
      throw new Error(`Action name is required in dependency: ${dep}`);
    }

    const newDep = {
      module: module || undefined,
      action: action ? action.slice(1) : undefined,
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
