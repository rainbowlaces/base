import { Renderable } from './renderable';

/**
 * The container for the output of the `html` function.
 */
export class TemplateResult extends Renderable<Renderable[]> {
  pre(value: Renderable[]): Renderable[] {
    return value;
  }
}
