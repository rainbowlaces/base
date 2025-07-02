import { Tag, type TagConfig } from '../tag';
import { tag } from '../../decorators/tag';
import { type TemplateOrString } from '../../types';
import { type Renderable } from '../renderable';

interface IfTagParams extends TagConfig {
  then: TemplateOrString;
  else?: TemplateOrString;
}

@tag()
export class IfTag extends Tag<boolean, IfTagParams> {
  readonly name = 'if';

  async pre(value: boolean): Promise<string | Renderable> {
    return value ? this.params.then : (this.params.else ?? '');
  }
}

declare module "../../types" {
  interface TemplateTags {
    if: IfTag;
  }
}