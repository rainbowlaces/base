import { Tag, type TagConfig } from '../tag.js';
import type { Renderable } from '../renderable.js';
import { tag } from '../../decorators/tag.js';
import { type Optional, type TemplateOrString, type MaybeAsync } from '../../types.js';

type MaybeAsyncIterable<T> = MaybeAsync<Iterable<T> | AsyncIterable<T>>;

interface EachTagParams<I = unknown> extends TagConfig{
  do?: (item: I) => Promise<Renderable> | Renderable;
  else?: TemplateOrString;
}

@tag()
export class EachTag<TItem = unknown> extends Tag<Optional<Iterable<TItem> | AsyncIterable<TItem>>, EachTagParams<TItem>> {
  readonly name = 'each';  

  async pre(value: MaybeAsyncIterable<TItem> | null | undefined): Promise<unknown> {
    const resolvedValue = await value;
    
    if (!resolvedValue) {
      return this.params.else ?? "";
    }

    // Convert both sync and async iterables to arrays
    const items: TItem[] = [];
    
    if (Symbol.asyncIterator in resolvedValue) {
      // Handle AsyncIterable
      for await (const item of resolvedValue) {
        items.push(item);
      }
    } else {
      // Handle regular Iterable
      for (const item of resolvedValue) {
        items.push(item);
      }
    }
    
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

declare module "../../types.js" {
  interface TemplateTags {
    each: EachTag;
  }
}
