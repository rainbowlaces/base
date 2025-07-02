import { type MaybeAsync } from '../types';
import { Renderable } from './renderable';

export type TagConfig = Record<string, MaybeAsync<unknown>>;

/**
 * The async-aware base class for all logic tags.
 */
export abstract class Tag<T = MaybeAsync<unknown>, P extends TagConfig = TagConfig> extends Renderable<T> {
  protected readonly params: P;
  abstract get name(): string;

  constructor(value?: T, params?: P) {
    super(value as T);
    this.params = params as P;
  }
}
