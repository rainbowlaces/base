import { Renderable } from './renderable.js';

/**
 * The container for the output of the `html` function.
 */
export class TemplateResult extends Renderable<Renderable[]> {
  pre(value: Renderable[]): Renderable[] {
    return value;
  }
}
