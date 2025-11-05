/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseModelCollection } from "../baseModelCollection.js";
import { BaseError } from "../../baseErrors.js";
import { 
    type FieldOptions, 
    type ModelData, 
    type ModelConstructor, 
    type EmbedMany, 
    type FieldMetadata,
    type IBaseModel,
    type IBaseModelDecoratorAccessor,
} from "../types.js";
import { field, FIELD_METADATA_SYMBOL } from "./field.js";
import { type Thunk, resolve } from "../../../utils/thunk.js";

/**
 * Decorator for embedding an array of model instances.
 * The embedded models are stored as an array of serialized data within the parent model.
 * 
 * @param model - The model constructor or thunk to resolve it
 * @param options - Field options (readOnly, default, etc.)
 * @returns Decorator function that creates a function-like accessor
 */
export function embedMany<T extends IBaseModel>(
    model: ModelConstructor<T> | Thunk<ModelConstructor<T>>,
    options: FieldOptions = {}
): (target: unknown, context: ClassAccessorDecoratorContext<IBaseModel, EmbedMany<T>>) => ClassAccessorDecoratorResult<IBaseModel, EmbedMany<T>> {
    return function(target: unknown, context: ClassAccessorDecoratorContext<IBaseModel, EmbedMany<T>>) {
        const propertyName = context.name as string;

        // 1. Attach metadata using @field decorator
        const fieldDecorator = field(options);

        // 2. Apply the base decorator to attach metadata
        const fieldResult = fieldDecorator(target, context);

        if (!fieldResult?.get) {
            // This should not happen for an accessor decorator
            throw new BaseError(`@embedMany decorator can only be used on accessors.`);
        }

        // 3. Add relation metadata
        const fieldMetadataContainer = (fieldResult.get as any)[FIELD_METADATA_SYMBOL] as { name: string; meta: FieldMetadata };
        fieldMetadataContainer.meta.relation = { type: 'embed', model, cardinality: 'many' };

        // 4. Create the function-like accessor for the embedded relationship
        const accessor = function(this: IBaseModel): EmbedMany<T> {
            // Resolve the model constructor from Thunk if needed
            const resolvedModel = resolve(model);
            
            return async function(this: IBaseModel, values?: T[] | BaseModelCollection<T>): Promise<BaseModelCollection<T> | void> {
                if (arguments.length > 0) {
                    let dataToSet: ModelData<T>[] = [];
                    if (values instanceof BaseModelCollection) {
                        dataToSet = await values.serialize();
                    }
                    else {
                        dataToSet = (values ?? []).map(v => v.serialize() as ModelData<T>);
                    }
                    (this as IBaseModel & IBaseModelDecoratorAccessor)._internalSet(propertyName, dataToSet);
                    return;
                } else {
                    // Getter: deserialize and return the collection
                    const rawDataArray = (this as IBaseModel & IBaseModelDecoratorAccessor)._internalGet<ModelData<T>[]>(propertyName);
                    return new BaseModelCollection(rawDataArray ?? [], resolvedModel);
                }
            }.bind(this) as EmbedMany<T>;
        };

        // 5. Copy the metadata from the field decorator to our accessor
        (accessor as any)[FIELD_METADATA_SYMBOL] = fieldMetadataContainer;

        // 6. Return the descriptor with function-like accessor
        return {
            get: accessor,
            set() { 
                throw new BaseError(`@embedMany property '${propertyName}' is function-like. Use ${propertyName}(value) to set.`);
            }
        };
    };
}
