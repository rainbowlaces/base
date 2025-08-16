export class Thunk<T> {
  #thunk: () => T;
  #cached?: T;

  constructor(thunk: () => T) {
    this.#thunk = thunk;
  }

  /** Run once, cache forever */
  resolve(): T {
    if (this.#cached === undefined) this.#cached = this.#thunk();
    return this.#cached;
  }
}

export function thunk<T>(f: () => T): Thunk<T> {
  return new Thunk(f);
}

export function resolve<T>(t: Thunk<T> | T): T {
  if (t instanceof Thunk) return t.resolve();
  return t;
};
