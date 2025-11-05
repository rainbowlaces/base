/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseError } from "../../baseErrors.js";
import { 
    type FieldOptions, 
    type ModelData, 
    type ModelConstructor, 
    type EmbedOne, 
    type FieldMetadata,
    type IBaseModel,
    type IBaseModelDecoratorAccessor,
} from "../types.js";
import { field, FIELD_METADATA_SYMBOL } from "./field.js";
import { type Thunk, resolve } from "../../../utils/thunk.js";

/**
 * Decorator for embedding a single model instance.
 * The embedded model is stored as serialized data within the parent model.
 * 
 * @param model - The model constructor or thunk to resolve it
 * @param options - Field options (readOnly, default, etc.)
 * @returns Decorator function that creates a function-like accessor
 */
export function embedOne<T extends IBaseModel>(
    model: ModelConstructor<T> | Thunk<ModelConstructor<T>>,
    options: FieldOptions = {}
): (target: unknown, context: ClassAccessorDecoratorContext<IBaseModel, EmbedOne<T>>) => ClassAccessorDecoratorResult<IBaseModel, EmbedOne<T>> {
    return function(target: unknown, context: ClassAccessorDecoratorContext<IBaseModel, EmbedOne<T>>) {
        const propertyName = context.name as string;

        // 1. Attach metadata using @field decorator
        const fieldDecorator = field(options);

        // 2. Apply the base decorator to attach metadata
        const fieldResult = fieldDecorator(target, context);

        if (!fieldResult?.get) {
            // This should not happen for an accessor decorator
            throw new BaseError(`@embedOne decorator can only be used on accessors.`);
        }

        // 3. Add relation metadata
        const fieldMetadataContainer = (fieldResult.get as any)[FIELD_METADATA_SYMBOL] as { name: string; meta: FieldMetadata };
        fieldMetadataContainer.meta.relation = { type: 'embed', model, cardinality: 'one' };

        // 4. Create the function-like accessor for the embedded relationship
        const accessor = function(this: IBaseModel): EmbedOne<T> {
            // Resolve the model constructor from Thunk if needed
            const resolvedModel = resolve(model);
            
            return async function(this: IBaseModel, value?: T): Promise<T | undefined> {
                if (arguments.length > 0) {
                    // Setter: store the serialized data
                    const dataToSet = value ? value.serialize() : undefined;
                    (this as IBaseModel & IBaseModelDecoratorAccessor)._internalSet(propertyName, dataToSet);
                    return;
                } else {
                    // Getter: deserialize and return the model
                    const rawData = (this as IBaseModel & IBaseModelDecoratorAccessor)._internalGet<ModelData<T>>(propertyName);
                    if (rawData === undefined || rawData === null) return undefined;
                    return await resolvedModel.fromData(rawData) as T;
                }
            }.bind(this) as EmbedOne<T>;
        };

        // 5. Copy the metadata from the field decorator to our accessor
        (accessor as any)[FIELD_METADATA_SYMBOL] = fieldMetadataContainer;

        // 6. Return the descriptor with function-like accessor
        return {
            get: accessor,
            set() { 
                throw new BaseError(`@embedOne property '${propertyName}' is function-like. Use ${propertyName}(value) to set.`);
            }
        };
    };
}
