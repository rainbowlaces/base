// We use the same 'any' escape hatch to keep the implementation simple.

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { type BaseModel } from "../baseModel";
import { type IdentifiableModelClass, type IdentifiableModel } from "../identifyableModel";
import { type FieldOptions, type Cardinality, type AsyncDefinedId, type AsyncDefinedIds, type FieldMetadata } from "../types";
import { type UniqueID } from "../uniqueId";
import { toUniqueIdAsync, toUniqueIdsAsync } from "../utils";

const FIELD_SYM = Symbol.for("model.field-meta");

export function reference<T extends IdentifiableModel<T>>(
    model: IdentifiableModelClass<T>,
    options: { cardinality: Cardinality } & FieldOptions<T | T[]>
) {
    return function<M extends BaseModel<M>>(_target: ClassAccessorDecoratorTarget<M, any>, context: ClassAccessorDecoratorContext) {
        const propertyName = String(context.name);
        
        // Use new unified metadata system with relation info
        const { cardinality, ...fieldOptions } = options;
        const metadata: FieldMetadata = {
            options: fieldOptions,
            relation: {
                type: 'reference',
                model: model,
                cardinality: cardinality,
            },
        };

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
                
                // Attach the payload to something that *will* end up in the class
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                (accessor as any)[FIELD_SYM] = { name: propertyName, meta: metadata };
                
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