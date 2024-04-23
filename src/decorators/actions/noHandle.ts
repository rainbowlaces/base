import { BaseAction } from "../../core/baseAction";

export default function noHandle() {
  // eslint-disable-next-line @typescript-eslint/ban-types
  return (t: Function, context: ClassMethodDecoratorContext): void => {
    if (context.kind !== "method") return;

    const target = t as BaseAction;
    target.handler = false;
  };
}
