type RecursiveMapOptions = {
  maxDepth?: number;
  maxItems?: number;
};

export function recursiveMap(
  input: unknown,
  transform: (value: unknown) => unknown | null,
  options: RecursiveMapOptions = {},
  currentDepth: number = 1,
  seen: WeakMap<object, unknown> = new WeakMap(),
): unknown {
  const { maxDepth = 10, maxItems = Infinity } = options;
  if (currentDepth > maxDepth) {
    return {};
  }

  const serialized = transform(input);
  if (serialized !== null) {
    return serialized;
  }

  if (typeof input === "object" && input !== null) {
    if (seen.has(input)) {
      return seen.get(input);
    }

    const entries = Array.isArray(input)
      ? input.map((item, index) => ({ key: index, value: item }))
      : Object.entries(input).map(([key, value]) => ({ key, value }));

    const limitedEntries = entries.slice(0, maxItems);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const copy: any = Array.isArray(input) ? [] : {};
    seen.set(input, copy);

    limitedEntries.forEach(({ key, value }) => {
      const transformedValue = recursiveMap(
        value,
        transform,
        options,
        currentDepth + 1,
        seen,
      );
      if (Array.isArray(copy)) {
        copy[key as number] = transformedValue;
      } else {
        copy[key as string] = transformedValue;
      }
    });

    return copy;
  } else {
    return input;
  }
}
