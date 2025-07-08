// We use the same 'any' escape hatch to keep the implementation simple.

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { BaseModel } from "../baseModel";
import { type FieldOptions, type Cardinality, type ModelData, type ModelConstructor, type FieldMetadata } from "../types";

const FIELD_SYM = Symbol.for("model.field-meta");

export function embed<T extends BaseModel<T>>(
    
    model: ModelConstructor<T>, 
    options: { cardinality: Cardinality } & FieldOptions<T | T[]>
) { 
    return function<M extends BaseModel<M>>(_target: ClassAccessorDecoratorTarget<M, any>, context: ClassAccessorDecoratorContext): any {
        const propertyName = context.name as string;

        // Use new unified metadata system with relation info
        const { cardinality, ...fieldOptions } = options;
        const metadata: FieldMetadata = {
            options: fieldOptions,
            relation: {
                type: 'embed',
                model: model,
                cardinality: cardinality,
            },
        };

        return {
            get(this: M): any {
                
                const accessor = async (...args: [any] | []): Promise<any> => {
                    
                    // --- SETTER LOGIC ---
                    if (args.length > 0) {
                        const value = await args[0];

                        if (options.cardinality === "one") {
                            const dataToSet = value instanceof BaseModel ? value.serialise() : value;
                            this.set<ModelData<T>>(propertyName, dataToSet);
                        } else {
                            const dataToSet = (value as any[]).map(item => 
                                item instanceof BaseModel ? item.serialise() : item
                            );
                            this.set<ModelData<T>[]>(propertyName, dataToSet);
                        }
                        return;
                    }

                    // --- GETTER LOGIC ---
                    if (!this.has(propertyName)) {
                        return options.cardinality === 'one' ? undefined : [];
                    }

                    if (options.cardinality === 'one') {
                        const rawData = this.get<ModelData<T>>(propertyName);
                        return await model.fromData(rawData);
                    }
                    
                    const rawDataArray = this.get<ModelData<T>[]>(propertyName);
                    return await Promise.all(
                        rawDataArray.map((data: ModelData<T>) => model.fromData(data))
                    );
                };
                
                // Attach the payload to something that *will* end up in the class
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                (accessor as any)[FIELD_SYM] = { name: propertyName, meta: metadata };
                
                return accessor;
            },

            set(this: M) {
                // Guide the developer to the correct usage pattern.
                throw new Error(
                    `Cannot directly set '${propertyName}'. Use 'await this.${propertyName}(newValue)' to set, or 'await this.${propertyName}()' to get.`
                );
            },
        };
    };
}