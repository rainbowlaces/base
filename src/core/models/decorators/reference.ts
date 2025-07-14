// We use the same 'any' escape hatch to keep the implementation simple.

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { type BaseModel } from "../baseModel.js";
import { type BaseIdentifiableModel } from "../baseIdentifiableModel.js";
import { type BaseModelCollection } from "../baseModelCollection.js";
import { BaseError } from "../../baseErrors.js";
import { type FieldOptions, type Cardinality, type AsyncDefinedId, type AsyncDefinedIds, type RefOne, type RefMany, type ModelConstructor } from "../types.js";
import { type UniqueID } from "../uniqueId.js";
import { toUniqueIdAsync, toUniqueIdsAsync } from "../utils.js";
import { field, FIELD_METADATA_SYMBOL } from "./field.js";
import { type Thunk, resolve } from "../../../utils/thunk.js";

// Overloads for different cardinalities
export function reference<T extends BaseIdentifiableModel>(
    model: ModelConstructor<T> | Thunk<ModelConstructor<T>>,
    options: { cardinality: "one" } & FieldOptions<T>
): <M extends BaseModel>(target: ClassAccessorDecoratorTarget<M, RefOne<T>>, context: ClassAccessorDecoratorContext) => ClassAccessorDecoratorResult<M, RefOne<T>>;

export function reference<T extends BaseIdentifiableModel>(
    model: ModelConstructor<T> | Thunk<ModelConstructor<T>>,
    options: { cardinality: "many" } & FieldOptions<T[]>
): <M extends BaseModel>(target: ClassAccessorDecoratorTarget<M, RefMany<T>>, context: ClassAccessorDecoratorContext) => ClassAccessorDecoratorResult<M, RefMany<T>>;

export function reference<T extends BaseIdentifiableModel>(
    model: ModelConstructor<T> | Thunk<ModelConstructor<T>>,
    options: { cardinality: Cardinality } & FieldOptions<T | T[]>
) {
    return function<M extends BaseModel>(target: unknown, context: ClassAccessorDecoratorContext<M, any>) {
        const propertyName = context.name as string;

        // 1. Delegate to the @field decorator factory.
        const fieldDecorator = field<any>({
            ...options,
            relation: { 
                type: 'reference', 
                model: model,
                cardinality: options.cardinality 
            }
        });

        // 2. Apply the base decorator to get the getter with metadata.
        const fieldResult = fieldDecorator(target, context);

        // 3. Create the custom function-like accessor.
        const accessor = function(this: M): RefOne<T> | RefMany<T> {
            // Resolve the model constructor from Thunk if needed
            const resolvedModel = resolve(model);
            
            if (options.cardinality === "one") {
                const refOne = async (...args: [] | [AsyncDefinedId<T>]): Promise<T | undefined> => {
                    if (args.length > 0) {
                        // Setter mode: store the ID
                        const value = args[0];
                        if (value !== undefined) {
                            const resolvedId = await toUniqueIdAsync(value as any);
                            this.set(propertyName, resolvedId);
                        } else {
                            this.set(propertyName, undefined);
                        }
                        return undefined;
                    } else {
                        // Getter mode: resolve the reference
                        const id = this.get<UniqueID>(propertyName);
                        if (!id) return undefined;
                        return (resolvedModel as any).byId(id);
                    }
                };
                return refOne as RefOne<T>;
            } else {
                const refMany = async (...args: [] | [AsyncDefinedIds<T>]): Promise<BaseModelCollection<T>> => {
                    if (args.length > 0) {
                        // Setter mode: store the IDs array
                        const value = args[0];
                        if (value) {
                            const resolvedIds = await toUniqueIdsAsync(value as any);
                            this.set(propertyName, resolvedIds);
                        } else {
                            return (resolvedModel as any).byIds([]);
                        }
                        // Return empty collection after setting
                        return (resolvedModel as any).byIds([]);
                    } else {
                        // Getter mode: resolve the references
                        const ids = this.get<UniqueID[]>(propertyName) || [];
                        return (resolvedModel as any).byIds(ids);
                    }
                };
                return refMany as RefMany<T>;
            }
        };

        // 4. Copy the metadata from @field's getter to our new accessor.
        (accessor as any)[FIELD_METADATA_SYMBOL] = (fieldResult.get as any)[FIELD_METADATA_SYMBOL];

        // 5. Return the final descriptor.
        return {
            get: accessor,
            set() {
                throw new BaseError(`Cannot directly assign to reference property '${propertyName}'. Use the function interface instead.`);
            }
        };
    };
}