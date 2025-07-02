import { Tag, type TagConfig } from '../tag';
import type { Renderable } from '../renderable';
import { tag } from '../../decorators/tag';
import { type Optional, type TemplateOrString } from '../../types';

interface EachTagParams<I = unknown> extends TagConfig{
  do?: (item: I) => Promise<Renderable> | Renderable;
  else?: TemplateOrString;
}

@tag()
export class EachTag<TItem = unknown> extends Tag<Optional<Iterable<TItem>>, EachTagParams<TItem>> {
  readonly name = 'each';  

  async pre(value: Iterable<TItem> | Promise<Iterable<TItem>> | null | undefined): Promise<unknown> {
    const resolvedValue = await value;
    const items = resolvedValue ? Array.from(resolvedValue) : [];
    
    if (items.length === 0) {
      return this.params.else ?? "";
    }
    // Render each item using the provided mapper or a safe default
    const renderItem: (item: TItem) => Promise<Renderable> | Renderable = this.params.do
      ?? ((_item: TItem) => '' as unknown as Renderable);

    const renderedItems = await Promise.all(items.map(async (item) => {
      const result = renderItem(item);
      return await result;
    }));

    return renderedItems;
  }
}

declare module "../../types" {
  interface TemplateTags {
    each: EachTag;
  }
}
