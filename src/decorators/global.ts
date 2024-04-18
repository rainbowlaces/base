import BaseModule from "../core/baseModule";
import { BaseAction } from "../core/baseAction";
import BaseDi from "../core/baseDi";

export default function global() {
  return function (
    this: unknown,
    target: BaseAction,
    context: ClassMethodDecoratorContext,
  ): void {
    if (context.kind !== "method") return;
    target.isGlobal = true;

    context.addInitializer(function () {
      const di = new BaseDi();
      const globalActions =
        di.resolve<Set<string>>("globalActions") || new Set();
      const name = `${(this as BaseModule).constructor.name}/${target.name}`;
      globalActions.add(name);
      BaseDi.register(globalActions, "globalActions");
    });
  };
}
