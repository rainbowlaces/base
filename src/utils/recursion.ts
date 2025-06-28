interface RecursiveMapOptions {
  maxDepth?: number;
  maxItems?: number;
}

export type TransformFunction<T = unknown, R = T> = (value: T) => R;
export type GetTransformerFunction<T = unknown, R = T> = (
  value: T,
) => TransformFunction<T, R> | null;

export function recursiveMap<T = unknown, R = T>(
  input: T,
  options: RecursiveMapOptions = {},
  getTransformer: GetTransformerFunction<T, R> = () => null,
  currentDepth = 1,
  seen = new WeakMap<object, R>(),
): R {
  const { maxDepth = 10, maxItems = Infinity } = options;
  if (currentDepth > maxDepth) {
    return {} as R;
  }

  const transformer = getTransformer(input);
  if (transformer !== null) {
    return transformer(input);
  }

  if (typeof input === "object" && input !== null) {
    if (seen.has(input)) {
      return seen.get(input)!;
    }

    const isInputArray = Array.isArray(input);
    const entries = isInputArray
      ? (input as unknown[]).map((item, index) => ({ key: index, value: item }))
      : Object.entries(input as Record<string, unknown>).map(([key, value]) => ({ key, value }));
    const limitedEntries = entries.slice(0, maxItems);

    const copy: unknown[] | Record<string, unknown> = isInputArray ? [] : {};
    seen.set(input, copy as R);

    limitedEntries.forEach(({ key, value }) => {
      const transformedValue = recursiveMap(
        value as T,
        options,
        getTransformer,
        currentDepth + 1,
        seen,
      );
      if (isInputArray && Array.isArray(copy) && typeof key === 'number') {
        copy[key] = transformedValue;
      } else if (!isInputArray && !Array.isArray(copy) && typeof key === 'string') {
        copy[key] = transformedValue;
      }
    });

    return copy as R;
  } else {
    return input as unknown as R;
  }
}

/**
 * Recursively merges two objects, where properties from the `apply` object
 * override those in the `base` object. For properties existing as objects
 * in both `base` and `apply`, their contents are merged recursively.
 *
 * @param base - The base object to merge into.
 * @param apply - The object whose properties will override or extend the base object.
 * @returns - The result of merging `apply` into `base`.
 */
export function merge(
  base: Record<string, unknown>,
  apply: Record<string, unknown>,
): Record<string, unknown> {
  // Helper function to check if value is a plain object
  const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && 
           value !== null && 
           !Array.isArray(value) && 
           value.constructor === Object;
  };

  // Helper function to merge two objects
  const mergeObjects = (target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> => {
    Object.keys(source).forEach((key) => {
      const sourceValue = source[key];
      const targetValue = target[key];

      // If both values are plain objects, merge them recursively
      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        target[key] = mergeObjects({ ...targetValue }, sourceValue);
      } else {
        // Overwrite the target with the source value for arrays, primitives, or if the target is not an object
        target[key] = sourceValue;
      }
    });
    return target;
  };

  // Initiate the merge process
  return mergeObjects({ ...base }, apply);
}
