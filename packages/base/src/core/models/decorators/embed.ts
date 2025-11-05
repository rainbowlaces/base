/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseModelCollection } from "../baseModelCollection.js";
import { BaseError } from "../../baseErrors.js";
import { 
    type FieldOptions, 
    type Cardinality, 
    type ModelData, 
    type ModelConstructor, 
    type EmbedOne, 
    type EmbedMany, 
    type FieldMetadata,
    type IBaseModel,
    type IBaseModelDecoratorAccessor,
} from "../types.js";
import { field, FIELD_METADATA_SYMBOL } from "./field.js";
import { type Thunk, resolve } from "../../../utils/thunk.js";

// EmbedOne overload: single embedded model
export function embed<T extends IBaseModel>(
    model: ModelConstructor<T> | Thunk<ModelConstructor<T>>,
    options: { cardinality: 'one' } & FieldOptions
): (target: unknown, context: ClassAccessorDecoratorContext<IBaseModel, EmbedOne<T>>) => ClassAccessorDecoratorResult<IBaseModel, EmbedOne<T>>;

// EmbedMany overload: array of embedded models  
export function embed<T extends IBaseModel>(
    model: ModelConstructor<T> | Thunk<ModelConstructor<T>>,
    options: { cardinality: 'many' } & FieldOptions
): (target: unknown, context: ClassAccessorDecoratorContext<IBaseModel, EmbedMany<T>>) => ClassAccessorDecoratorResult<IBaseModel, EmbedMany<T>>;

// Implementation follows the "Attach and Collect" pattern
export function embed<T extends IBaseModel>(
    model: ModelConstructor<T> | Thunk<ModelConstructor<T>>,
    options: { cardinality: Cardinality } & FieldOptions
) {
    return function(target: unknown, context: ClassAccessorDecoratorContext<IBaseModel, EmbedOne<T> | EmbedMany<T>>) {
        const propertyName = context.name as string;

        // 1. Attach metadata using @field decorator
        const fieldDecorator = field(options);

        // 2. Apply the base decorator to attach metadata
        const fieldResult = fieldDecorator(target, context);

        if (!fieldResult?.get) {
            // This should not happen for an accessor decorator
            throw new BaseError(`@embed decorator can only be used on accessors.`);
        }

        // 3. Add relation metadata
        const fieldMetadataContainer = (fieldResult.get as any)[FIELD_METADATA_SYMBOL] as { name: string; meta: FieldMetadata };
        fieldMetadataContainer.meta.relation = { type: 'embed', model, cardinality: options.cardinality };

        // 4. Create the function-like accessor for the embedded relationship
        const accessor = function(this: IBaseModel): EmbedOne<T> | EmbedMany<T> {
            // Resolve the model constructor from Thunk if needed
            const resolvedModel = resolve(model);
            
            if (options.cardinality === 'one') {
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
            } else {
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
            }
        };

        // 5. Copy the metadata from the field decorator to our accessor
        (accessor as any)[FIELD_METADATA_SYMBOL] = fieldMetadataContainer;

        // 6. Return the descriptor with function-like accessor
        return {
            get: accessor,
            set() { 
                throw new BaseError(`@embed property '${propertyName}' is function-like. Use ${propertyName}(value) to set.`);
            }
        };
    };
}