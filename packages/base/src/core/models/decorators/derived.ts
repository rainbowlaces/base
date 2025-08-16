/* eslint-disable @typescript-eslint/no-explicit-any */

import { type BaseModel } from "../baseModel.js";
import { type FieldOptions, type FieldMetadata, type Derived } from "../types.js";
import { FIELD_METADATA_SYMBOL } from "./field.js";

type Target<M, T> = (this: M) => Derived<T>

/**
 * Decorator for derived fields on a model.
 * A derived field is an async method that computes its value on the fly and is not persisted.
 * This decorator marks the method so its result is included in the model's `derive()` output.
 * It can only be used on async methods.
 *
 * @param opts - Optional field options.
 *
 * @example
 * @model
 * class Article extends BaseModel {
 * @derived()
 * async wordCount(): Derived<Promise<number>> {
 * const content = await this.content(); // Assuming content is async
 * return content.split(' ').length;
 * }
 * }
 */
export function derived<T>(opts: FieldOptions<T> = {}) {
  return function <M extends BaseModel>(
    target: Target<M, T>,
    ctx: ClassMethodDecoratorContext<M, Target<M, T>>
  ) {
    // A runtime check to ensure it's not misused, though TypeScript should prevent this.
    if (ctx.kind !== 'method') {
      throw new Error('@derived decorator can only be used on async methods, not accessors or other class elements.');
    }

    const name = String(ctx.name);
    const meta: FieldMetadata = { options: { ...opts, derived: true } };

    // Attach the metadata to the method itself using the shared symbol.
    // The @model decorator will collect this during schema construction.
    (target as any)[FIELD_METADATA_SYMBOL] = { name, meta };
  };
}