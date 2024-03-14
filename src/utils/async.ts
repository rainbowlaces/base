export async function delay(timeout: number = 0) {
  if (!timeout) return new Promise((resolve) => setImmediate(resolve));
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

export async function asyncMap<T, R = void>(
  iterable:
    | Iterable<T>
    | AsyncIterable<T>
    | Promise<Iterable<T> | AsyncIterable<T>>,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  // If the iterable is a promise, await it
  iterable = await iterable;

  // Check if the iterable is an async iterable
  if (Symbol.asyncIterator in Object(iterable)) {
    const asyncIterable = iterable as AsyncIterable<T>;
    const results: R[] = [];
    for await (const item of asyncIterable) {
      results.push(await fn(item));
    }
    return results;
  } else {
    // The iterable is a synchronous iterable
    const syncIterable = iterable as Iterable<T>;
    return Promise.all(Array.from(syncIterable).map(fn));
  }
}
