import { type BaseModel } from "../baseModel.js";
import { type FieldOptions, type FieldMetadata } from "../types.js";

export const FIELD_METADATA_SYMBOL = Symbol.for("model.field-meta");

export function field<T>(opts: FieldOptions<T> = {}) {
  return function <M extends BaseModel>(
    target: unknown,
    ctx: ClassAccessorDecoratorContext<M, T> | ClassMethodDecoratorContext<M, () => Promise<T>>
  ) {
    const name = String(ctx.name);

    // If the decorator is on a method, it is implicitly a derived field.
    if (ctx.kind === 'method') {
        const meta: FieldMetadata = { options: { ...opts, derived: true } };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (target as any)[FIELD_METADATA_SYMBOL] = { name, meta };
        return;
    }
    
    // Extract relation from options if present (for extended field options)
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