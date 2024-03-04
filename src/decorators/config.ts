/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A decorator for injecting configuration values into class fields. It allows for specifying
 * a default value and a custom mapping to a configuration key. This decorator simplifies the
 * process of accessing configuration values within modules by automatically handling the retrieval
 * of configuration data based on the field's name or a provided custom key.
 */
export default function config(
  mapping?: string,
): (value: unknown, context: ClassFieldDecoratorContext) => void {
  return (value: unknown, context: ClassFieldDecoratorContext): unknown => {
    if (context.kind !== "field") return;
    return function (this: any, initialValue: any): unknown {
      if (!(this as any)._config) return initialValue;
      const _map = mapping ?? context.name;
      const val = (this as any)._config[_map] ?? initialValue;
      return val;
    };
  };
}
