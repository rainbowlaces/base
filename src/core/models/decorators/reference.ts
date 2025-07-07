// We use the same 'any' escape hatch to keep the implementation simple.

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { type BaseModel } from "../baseModel";
import { type IdentifiableModelClass, type IdentifiableModel } from "../identifyableModel";
import { type FieldOptions, type Cardinality, type AsyncDefinedId, type AsyncDefinedIds } from "../types";
import { type UniqueID } from "../uniqueId";
import { toUniqueIdAsync, toUniqueIdsAsync } from "../utils";

export function reference<T extends IdentifiableModel<T>>(
    model: IdentifiableModelClass<T>,
    options: { cardinality: Cardinality } & FieldOptions<T | T[]>
) {
    return function<M extends BaseModel<M>>(target: ClassAccessorDecoratorTarget<M, any>, context: ClassAccessorDecoratorContext) {
        const constructor = target.constructor as typeof BaseModel;
        const propertyName = String(context.name);
        
        // Register the underlying field that stores the ID.
        constructor.registerField(propertyName, options);

        return {
            get(this: M): any {
                
                const accessor = async (...args: [any] | []): Promise<any> => {
                    
                    // --- SETTER LOGIC ---
                    if (args.length > 0) {
                        const value = args[0];
                        if (options.cardinality === "one") {
                            const resolvedId = await toUniqueIdAsync(value as AsyncDefinedId<T>);
                            this.set<UniqueID>(propertyName, resolvedId);
                            return; 
                        }
                        const resolvedIds = await toUniqueIdsAsync(value as AsyncDefinedIds<T>);
                        this.set<UniqueID[]>(propertyName, resolvedIds);
                        return;
                    }

                    // --- GETTER LOGIC ---
                    if (!this.has(propertyName)) {
                        return options.cardinality === 'one' ? undefined : [];
                    }

                    if (options.cardinality === 'one') {
                        const id = this.get<UniqueID>(propertyName);
                        return model.byId(id);
                    }
                    
                    const ids = this.get<UniqueID[]>(propertyName);
                    return model.byIds(ids);
                };
                
                return accessor;
            },

            /**
             * The setter throws an error to guide the developer to the correct pattern.
             * This is crucial for usability.
             */
            set(this: M) {
                throw new Error(
                    `Cannot directly set '${propertyName}'. Use 'await this.${propertyName}(newValue)' to set, or 'await this.${propertyName}()' to get.`
                );
            },
        };
    };
}