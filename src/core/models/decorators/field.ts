/* eslint-disable @typescript-eslint/no-explicit-any */
 

import { type BaseModel } from "../baseModel.js";
import { type FieldOptions, type FieldMetadata } from "../types.js";

// Type that allows FieldOptions plus any additional metadata properties
type ExtendedFieldOptions<T> = FieldOptions<T> & Omit<FieldMetadata, "options">;

export const FIELD_METADATA_SYMBOL = Symbol.for("model.field-meta");

export function field<T>(opts: ExtendedFieldOptions<T> = {} as ExtendedFieldOptions<T>) {
  return function <M extends BaseModel>(
    _ignored: unknown,
    ctx: ClassAccessorDecoratorContext<M, T>
  ) {
    const { readOnly, default: def, hydrator, validator, serializer, ...rest } = opts;
    const meta: FieldMetadata = {
      options: { readOnly, default: def, hydrator, validator, serializer },
      ...rest,
    };
    const name = ctx.name as string;

    function getter(this: M): T {
      return this.get(name);
    }
    function setter(this: M, v: T) {
      this.set(name, v);
    }

    // Attach the payload to something that *will* end up in the class
    (getter as any)[FIELD_METADATA_SYMBOL] = { name, meta };

    return { get: getter, set: setter, enumerable: true, configurable: true };
  };
}
