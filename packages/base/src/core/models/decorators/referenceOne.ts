// We use the same 'any' escape hatch to keep the implementation simple. 
/* eslint-disable @typescript-eslint/no-explicit-any */

import { type BaseIdentifiableModel } from "../baseIdentifiableModel.js";
import { BaseError } from "../../baseErrors.js";
import { type FieldOptions, type AsyncDefinedId, type RefOne, type ModelConstructor, type FieldMetadata, type IBaseModel, type IBaseModelDecoratorAccessor } from "../types.js";
import { type UniqueID } from "../uniqueId.js";
import { toUniqueIdAsync } from "../utils.js";
import { field, FIELD_METADATA_SYMBOL } from "./field.js";
import { type Thunk, resolve } from "../../../utils/thunk.js";

/**
 * Decorator for referencing a single identifiable model by ID.
 * Stores the ID and resolves the model instance on access.
 * 
 * @param model - The model constructor or thunk to resolve it
 * @param options - Field options (readOnly, default, etc.)
 * @returns Decorator function that creates a function-like accessor
 */
export function referenceOne<T extends BaseIdentifiableModel>(
    model: ModelConstructor<T> | Thunk<ModelConstructor<T>>,
    options: FieldOptions<T> = {}
): <M extends IBaseModel>(target: ClassAccessorDecoratorTarget<M, RefOne<T>>, context: ClassAccessorDecoratorContext) => ClassAccessorDecoratorResult<M, RefOne<T>> {
    return function<M extends IBaseModel>(target: unknown, context: ClassAccessorDecoratorContext<M, any>) {
        const propertyName = context.name as string;

        // 1. Delegate to the @field decorator factory.
        const fieldDecorator = field<any>(options);

        // 2. Apply the base decorator to get the getter with metadata.
        const fieldResult = fieldDecorator(target, context);

        if (!fieldResult?.get) {
            throw new BaseError(`@referenceOne decorator can only be used on accessors.`);
        }

        // 3. Add relation metadata
        const fieldInfo = (fieldResult.get as any)[FIELD_METADATA_SYMBOL] as { name: string; meta: FieldMetadata };
        fieldInfo.meta.relation = { 
            type: 'reference', 
            model: model,
            cardinality: 'one' 
        };

        // 4. Create the custom function-like accessor.
        const accessor = function(this: M): RefOne<T> {
            // Resolve the model constructor from Thunk if needed
            const resolvedModel = resolve(model);
            
            const refOne = async (...args: [] | [AsyncDefinedId<T>]): Promise<T | undefined> => {
                if (args.length > 0) {
                    // Setter mode: store the ID
                    const value = args[0];
                    if (value !== undefined) {
                        const resolvedId = await toUniqueIdAsync(value as any);
                        (this as M & IBaseModelDecoratorAccessor)._internalSet(propertyName, resolvedId);
                    } else {
                        (this as M & IBaseModelDecoratorAccessor)._internalSet(propertyName, undefined);
                    }
                    return undefined;
                } else {
                    // Getter mode: resolve the reference
                    const id = (this as M & IBaseModelDecoratorAccessor)._internalGet<UniqueID>(propertyName);
                    if (!id) return undefined;
                    return (resolvedModel as any).byId(id);
                }
            };
            return refOne as RefOne<T>;
        };

        // 5. Copy the metadata from @field's getter to our new accessor.
        (accessor as any)[FIELD_METADATA_SYMBOL] = fieldInfo;

        // 6. Return the final descriptor.
        return {
            get: accessor,
            set() {
                throw new BaseError(`Cannot directly assign to reference property '${propertyName}'. Use the function interface instead.`);
            }
        };
    };
}
