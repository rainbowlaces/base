/* eslint-disable @typescript-eslint/no-explicit-any */

import { type BaseModel } from "../baseModel";
import { type FieldOptions, type FieldMetadata } from "../types";

// Type that allows FieldOptions plus any additional metadata properties
type ExtendedFieldOptions<T> = FieldOptions<T> & Omit<FieldMetadata, "options">;

const FIELD_SYM = Symbol.for("model.field-meta");

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export function field<T>(opts: ExtendedFieldOptions<T> = {} as any) {
  return function <M extends BaseModel<M>>(
    _ignored: unknown,
    ctx: ClassAccessorDecoratorContext<M, T>
  ) {
    const { readOnly, default: def, ...rest } = opts;
    const meta: FieldMetadata = {
      options: { readOnly, default: def },
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (getter as any)[FIELD_SYM] = { name, meta };

    return { get: getter, set: setter, enumerable: true, configurable: true };
  };
}
