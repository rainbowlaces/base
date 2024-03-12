export async function delay(timeout: number = 0) {
  if (!timeout) return new Promise((resolve) => setImmediate(resolve));
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

export async function asyncEach<T>(
  arr: Iterable<T> | Promise<Iterable<T>>,
  fn: (item: T) => Promise<void>,
) {
  if (arr instanceof Promise) arr = await arr;
  return Promise.all(Array.from(arr).map(async (item: T) => await fn(item)));
}
