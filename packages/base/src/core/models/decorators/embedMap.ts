/* eslint-disable @typescript-eslint/no-explicit-any */

import { type BaseModel } from "../baseModel.js";
import { BaseError } from "../../baseErrors.js";
import { 
    type FieldOptions, 
    type ModelData, 
    type ModelConstructor, 
    type EmbedMap, 
    type NoDerivedModelData,
    type FieldMetadata
} from "../types.js";
import { field, FIELD_METADATA_SYMBOL } from "./field.js";
import { type Thunk, resolve } from "../../../utils/thunk.js";
import { type MaybeAsync } from "../../types.js";

/**
 * Decorator for embedded model maps.
 * Stores a keyed collection of embedded models as a Map<string, T> in code,
 * serialized as Record<string, ModelData<T>> in storage.
 * 
 * @param model - The model constructor or thunk to resolve it
 * @param options - Field options (readOnly, default, etc.)
 * @returns Decorator function that creates a function-like accessor
 */
export function embedMap<T extends BaseModel>(
    model: ModelConstructor | Thunk<ModelConstructor>,
    options: FieldOptions = {}
): (target: unknown, context: ClassAccessorDecoratorContext<BaseModel, EmbedMap<T>>) => ClassAccessorDecoratorResult<BaseModel, EmbedMap<T>> {
    return function(target: unknown, context: ClassAccessorDecoratorContext<BaseModel, EmbedMap<T>>) {
        const propertyName = context.name as string;

        // 1. Attach metadata using @field decorator
        const fieldDecorator = field(options);

        // 2. Apply the base decorator to attach metadata
        const fieldResult = fieldDecorator(target, context);

        if (!fieldResult?.get) {
            // This should not happen for an accessor decorator
            throw new BaseError(`@embedMap decorator can only be used on accessors.`);
        }

        // 3. Add relation metadata with structure: 'map'
        const fieldMetadataContainer = (fieldResult.get as any)[FIELD_METADATA_SYMBOL] as { name: string; meta: FieldMetadata };
        fieldMetadataContainer.meta.relation = { 
            type: 'embed', 
            model, 
            cardinality: 'many',  // Set to 'many' for collection checks
            structure: 'map'      // The critical discriminator
        };

        // 4. Create the function-like accessor for the embedded map relationship
        const accessor = function(this: BaseModel): EmbedMap<T> {
            // Resolve the model constructor from Thunk if needed
            const resolvedModel = resolve(model) as ModelConstructor<T>;
            
            return async function(this: BaseModel, value?: MaybeAsync<Map<string, T>>): Promise<Map<string, T> | void> {
                if (arguments.length > 0) {
                    // Setter: serialize the Map to a plain object
                    let resolvedValue = value;
                    
                    // Handle promises
                    if (resolvedValue instanceof Promise) {
                        resolvedValue = await resolvedValue;
                    }
                    
                    // Handle undefined/null as empty map
                    if (resolvedValue === undefined || resolvedValue === null) {
                        this._internalSet(propertyName, {});
                        return;
                    }
                    
                    // Convert Map<string, T> to Record<string, ModelData<T>>
                    const dataToSet: Record<string, NoDerivedModelData<T>> = {};
                    for (const [key, model] of resolvedValue.entries()) {
                        dataToSet[key] = model.serialize();
                    }
                    
                    this._internalSet(propertyName, dataToSet);
                    return;
                } else {
                    // Getter: deserialize the plain object to a Map
                    const rawData = this._internalGet<Record<string, ModelData<T>>>(propertyName);
                    
                    // Handle undefined/null as empty map
                    if (rawData === undefined || rawData === null) {
                        return new Map<string, T>();
                    }
                    
                    // Convert Record<string, ModelData<T>> to Map<string, T>
                    const entries: [string, T][] = [];
                    for (const [key, data] of Object.entries(rawData)) {
                        const hydratedModel = await resolvedModel.fromData(data);
                        entries.push([key, hydratedModel]);
                    }
                    
                    return new Map<string, T>(entries);
                }
            }.bind(this) as EmbedMap<T>;
        };

        // 5. Copy the metadata from the field decorator to our accessor
        (accessor as any)[FIELD_METADATA_SYMBOL] = fieldMetadataContainer;

        // 6. Return the descriptor with function-like accessor
        return {
            get: accessor,
            set() { 
                throw new BaseError(`@embedMap property '${propertyName}' is function-like. Use ${propertyName}(value) to set.`);
            }
        };
    };
}
