type RecursiveMapOptions = {
  maxDepth?: number;
  maxItems?: number;
};

export type TransformFunction = (value: unknown) => unknown;
export type GetTransformerFunction = (
  value: unknown,
) => TransformFunction | null;

export function recursiveMap(
  input: unknown,
  options: RecursiveMapOptions = {},
  getTransformer: GetTransformerFunction = () => null,
  currentDepth: number = 1,
  seen: WeakMap<object, unknown> = new WeakMap(),
): unknown {
  const { maxDepth = 10, maxItems = Infinity } = options;
  if (currentDepth > maxDepth) {
    return {};
  }

  const transformer = getTransformer(input);
  if (transformer !== null) {
    return transformer(input);
  }

  if (typeof input === "object" && input !== null) {
    if (seen.has(input)) {
      return seen.get(input);
    }

    const isInputArray = Array.isArray(input);
    const entries = isInputArray
      ? input.map((item, index) => ({ key: index, value: item }))
      : Object.entries(input).map(([key, value]) => ({ key, value }));
    const limitedEntries = entries.slice(0, maxItems);

    const copy: unknown[] | Record<string, unknown> = isInputArray ? [] : {};
    seen.set(input, copy);

    limitedEntries.forEach(({ key, value }) => {
      const transformedValue = recursiveMap(
        value,
        options,
        getTransformer,
        currentDepth + 1,
        seen,
      );
      if (isInputArray) {
        (copy as unknown[])[key as number] = transformedValue;
      } else {
        (copy as Record<string, unknown>)[key] = transformedValue;
      }
    });

    return copy;
  } else {
    return input;
  }
}
