export async function delay(timeout: number = 0) {
  if (!timeout) return new Promise((resolve) => setImmediate(resolve));
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

export async function asyncMap<T, R = void>(
  iterable:
    | Iterable<T>
    | AsyncIterable<T>
    | Promise<Iterable<T> | AsyncIterable<T>>,
  fn: (item: T) => Promise<R | undefined>,
): Promise<R[]> {
  iterable = await iterable;

  if (Symbol.asyncIterator in Object(iterable)) {
    const asyncIterable = iterable as AsyncIterable<T>;
    const results: R[] = [];
    for await (const item of asyncIterable) {
      const i = await fn(item);
      if (i !== undefined) results.push(i);
    }
    return results;
  } else {
    const res = await Promise.all(Array.from(iterable as Iterable<T>).map(fn));
    return res.filter((r) => r !== undefined) as R[];
  }
}

type AsyncPredicate<T> = (item: T) => Promise<boolean>;

export async function asyncFilter<T>(
  iterable:
    | Iterable<T>
    | AsyncIterable<T>
    | Promise<Iterable<T> | AsyncIterable<T>>,
  predicate: AsyncPredicate<T> = async (v) => !!v,
): Promise<T[]> {
  iterable = await iterable;

  const results: T[] = [];

  if (Symbol.asyncIterator in Object(iterable)) {
    const asyncIterable = iterable as AsyncIterable<T>;
    for await (const item of asyncIterable) {
      if (await predicate(item)) {
        results.push(item);
      }
    }
  } else {
    for (const item of iterable as Iterable<T>) {
      if (await predicate(item)) {
        results.push(item);
      }
    }
  }

  return results;
}
