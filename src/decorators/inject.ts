import BaseModule from "../core/baseModule";
/**
 * A decorator for injecting configuration values into class fields. It allows for specifying
 * a default value and a custom mapping to a configuration key. This decorator simplifies the
 * process of accessing configuration values within modules by automatically handling the retrieval
 * of configuration data based on the field's name or a provided custom key.
 */
export default function inject<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ModuleClass: new (...args: any[]) => T,
): (value: unknown, context: ClassFieldDecoratorContext) => void {
  return (value: unknown, context: ClassFieldDecoratorContext): unknown => {
    if (context.kind !== "field") return;
    return function (this: BaseModule): T {
      return this.base.getModule<T>(ModuleClass.name);
    };
  };
}
