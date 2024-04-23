import BaseDi from "../../core/baseDi";
import { BaseAction } from "../../core/baseAction";
import BaseModule from "../../core/baseModule";

export default function global() {
  // eslint-disable-next-line @typescript-eslint/ban-types
  return (t: Function, context: ClassMethodDecoratorContext): void => {
    if (context.kind !== "method") return;

    const target = t as BaseAction;
    target.isGlobal = true;

    context.addInitializer(function () {
      const globalActions =
        BaseDi.create().resolve<Set<string>>(`${target.type}/globalActions`) ||
        new Set();
      globalActions.add(
        `${(this as BaseModule).constructor.name}/${target.name}`,
      );
      BaseDi.register(globalActions, `${target.type}/globalActions`);
    });
  };
}
