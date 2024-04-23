import BaseDi from "../core/baseDi";

export default function di<T = string>(
  key: string,
  ...args: unknown[]
): (value: unknown, context: ClassFieldDecoratorContext) => void {
  return (
    value: unknown,
    context: ClassFieldDecoratorContext,
  ): undefined | ((initialValue: T) => T) => {
    if (context.kind !== "field") return;
    return function (initialValue: T): T {
      const val = BaseDi.create().resolve<T>(key, ...args);
      if (!val) return initialValue as T;
      return val as T;
    };
  };
}
