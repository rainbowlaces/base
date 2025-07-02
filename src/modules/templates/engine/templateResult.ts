import { Renderable } from './renderable';
import { TemplateValue } from './templateValue';

/**
 * The container for the output of the `html` function.
 */
export class TemplateResult extends Renderable<Renderable[]> {
  public readonly parts: Renderable[];

  constructor(parts: Renderable[]) {
    super(parts);
    this.parts = parts;
  }

  pre(value: Renderable[]): Renderable[] {
    return value;
  }
}
