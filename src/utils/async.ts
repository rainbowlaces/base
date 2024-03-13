export async function delay(timeout: number = 0) {
  if (!timeout) return new Promise((resolve) => setImmediate(resolve));
  return new Promise((resolve) => setTimeout(resolve, timeout));
}
export async function asyncMap<T, R = void>(
  arr: Iterable<T> | Promise<Iterable<T>>,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (arr instanceof Promise) arr = await arr;
  return Promise.all(Array.from(arr).map((item: T) => fn(item)));
}
