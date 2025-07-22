import { type BaseModel } from "../baseModel.js";
import { type FieldOptions, type FieldMetadata } from "../types.js";

export const FIELD_METADATA_SYMBOL = Symbol.for("model.field-meta");

export function field<T>(opts: FieldOptions<T> = {}) {
  // The signature now only accepts an accessor context.
  return function <M extends BaseModel>(
    _target: unknown,
    ctx: ClassAccessorDecoratorContext<M, T>
  ) {
    // The check for method kind is now removed.
    if (ctx.kind !== 'accessor') {
      // This is defensive, as the type signature should enforce it.
      throw new Error("@field can only be used on class accessors.");
    }

    const name = String(ctx.name);
    
    const optsWithRelation = opts as FieldOptions<T> & { relation?: FieldMetadata['relation'] };
    const { relation, ...fieldOptions } = optsWithRelation;
    const meta: FieldMetadata = { 
        options: fieldOptions,
        ...(relation && { relation })
    };

    function getter(this: M): T { return this.get(name); }
    function setter(this: M, v: T) { this.set(name, v); }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (getter as any)[FIELD_METADATA_SYMBOL] = { name, meta };
    return { get: getter, set: setter, enumerable: true, configurable: true };
  };
}