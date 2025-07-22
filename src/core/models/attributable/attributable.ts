import { type BaseModel } from '../baseModel.js';
import { embed } from '../decorators/embed.js';
import { type EmbedMany } from '../types.js';
import { Attribute } from './attribute.js';
import { UniqueID } from '../uniqueId.js';
import { type AttributeSpec, type AttributeValue, type GetAttributeReturn } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConstructor<T = object> = abstract new (...args: any[]) => T;

// Define the public interface for attributable functionality
export interface AttributableInterface {
    attributes: EmbedMany<Attribute>;
    readonly Attributes: AttributeSpec;
    setAttribute<K extends keyof AttributeSpec>(name: K, value: AttributeValue<AttributeSpec, K>): Promise<void>;
    getAttribute<K extends keyof AttributeSpec>(name: K): Promise<GetAttributeReturn<AttributeSpec, K>>;
    hasAttribute<K extends keyof AttributeSpec>(name: K, value?: AttributeValue<AttributeSpec, K>): Promise<boolean>;
    deleteAttribute<K extends keyof AttributeSpec>(name: K, value?: AttributeValue<AttributeSpec, K>): Promise<void>;
}

// Create a named return type for the mixin
export type AttributableMixin<TBase extends AnyConstructor<BaseModel>> = TBase & AnyConstructor<AttributableInterface>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Attributable<TBase extends AnyConstructor<BaseModel>>(Base: TBase): AttributableMixin<TBase> {
    abstract class AttributableClass extends Base implements AttributableInterface {
        @embed(Attribute, { cardinality: 'many', default: () => [] })
        accessor attributes!: EmbedMany<Attribute>;

        public readonly Attributes!: AttributeSpec;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constructor(...args: any[]) {
            super(...args);
        }

        async setAttribute<K extends keyof this['Attributes']>(name: K, value: AttributeValue<this['Attributes'], K>): Promise<void> {
            const collection = await this.attributes();
            const allCurrent = await collection.toArray();
            const attributes = this.Attributes || {};
            const spec = attributes[name as string];
            const isSingle = spec && spec[1] === 'single';

            const newAttribute = await Attribute.create({ 
                name: name as string, 
                value: value as string | number | boolean | Date | UniqueID, 
                created: new Date() 
            });

            // Helper function to compare values with special handling for UniqueID and Date
            const compareValues = (v: unknown, target: unknown): boolean => {
                if (v instanceof UniqueID && target instanceof UniqueID) {
                    return v.equals(target);
                }
                if (v instanceof Date && target instanceof Date) {
                    return v.getTime() === target.getTime();
                }
                return v === target;
            };

            const filtered = allCurrent.filter(attr => {
                if (attr.name !== name) return true; // Keep attributes with different names
                if (isSingle) return false; // Remove all with this name if 'single'
                
                // For 'many', remove only if value matches
                return !compareValues(attr.value, value);
            });

            await this.attributes([...filtered, newAttribute]);
        }

        async getAttribute<K extends keyof this['Attributes']>(name: K): Promise<GetAttributeReturn<this['Attributes'], K>> {
            const collection = await this.attributes();
            const all = await collection.toArray();
            const values = all
                .filter(attr => attr.name === name)
                .map(attr => attr.value) as AttributeValue<this['Attributes'], K>[];

            const attributes = this.Attributes || {};
            const spec = attributes[name as string];
            const isSingle = spec && spec[1] === 'single';

            return (isSingle ? values[0] : values) as GetAttributeReturn<this['Attributes'], K>;
        }

        async hasAttribute<K extends keyof this['Attributes']>(name: K, value?: AttributeValue<this['Attributes'], K>): Promise<boolean> {
            const values = await this.getAttribute(name);
            if (value === undefined) {
                return Array.isArray(values) ? values.length > 0 : values !== undefined;
            }
            
            // Helper function to compare values with special handling for UniqueID and Date
            const compareValues = (v: unknown, target: unknown): boolean => {
                if (v instanceof UniqueID && target instanceof UniqueID) {
                    return v.equals(target);
                }
                if (v instanceof Date && target instanceof Date) {
                    return v.getTime() === target.getTime();
                }
                return v === target;
            };

            if (Array.isArray(values)) {
                return values.some(v => compareValues(v, value));
            } else {
                return compareValues(values, value);
            }
        }

        async deleteAttribute<K extends keyof this['Attributes']>(name: K, value?: AttributeValue<this['Attributes'], K>): Promise<void> {
            const collection = await this.attributes();
            const allCurrent = await collection.toArray();

            // Helper function to compare values with special handling for UniqueID and Date
            const compareValues = (v: unknown, target: unknown): boolean => {
                if (v instanceof UniqueID && target instanceof UniqueID) {
                    return v.equals(target);
                }
                if (v instanceof Date && target instanceof Date) {
                    return v.getTime() === target.getTime();
                }
                return v === target;
            };

            const remaining = allCurrent.filter(attr => {
                if (attr.name !== name) return true;
                // If value is specified, remove only that one. If not, remove all with that name.
                if (value !== undefined) {
                    return !compareValues(attr.value, value);
                }
                return false; // Remove all with that name
            });

            await this.attributes(remaining);
        }
    }

    return AttributableClass as AttributableMixin<TBase>;
}
