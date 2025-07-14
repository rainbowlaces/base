import { Tag, type TagConfig } from '../tag.js';
import { tag } from '../../decorators/tag.js';
import { type TemplateOrString } from '../../types.js';
import { type Renderable } from '../renderable.js';

interface IfTagParams extends TagConfig {
  then: TemplateOrString;
  else?: TemplateOrString;
}

@tag()
export class IfTag extends Tag<boolean, IfTagParams> {
  readonly name = 'if';

  async pre(condition: boolean): Promise<string | Renderable> {
    return condition ? this.params.then : (this.params.else ?? '');
  }
}

declare module "../../types.js" {
  interface TemplateTags {
    if: IfTag;
  }
}