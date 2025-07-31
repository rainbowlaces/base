import { type BaseModel } from "../baseModel.js";
import { embed } from "../decorators/embed.js";
import { type EmbedMany } from "../types.js";
import { Attribute } from "./attribute.js";
import { UniqueID } from "../uniqueId.js";
import {
  type AttributeSpec,
  type AttributeValue,
  type GetAttributeReturn,
  type ComplexAttributeType,
} from "../types.js";
import { BaseError } from "../../baseErrors.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConstructor<T = object> = abstract new (...args: any[]) => T;

// Define the public interface for attributable functionality
export interface AttributableInterface<TSpec extends AttributeSpec> {
  attributes: EmbedMany<Attribute>;
  readonly Attributes: TSpec;
  setAttribute<K extends keyof TSpec>(
    name: K,
    value: AttributeValue<TSpec, K>
  ): Promise<void>;
  getAttribute<K extends keyof TSpec>(
    name: K
  ): Promise<GetAttributeReturn<TSpec, K>>;
  hasAttribute<K extends keyof TSpec>(
    name: K,
    value?: AttributeValue<TSpec, K>
  ): Promise<boolean>;
  deleteAttribute<K extends keyof TSpec>(
    name: K,
    value?: AttributeValue<TSpec, K>
  ): Promise<void>;
  getRawAttributes<K extends keyof TSpec>(
    name?: K
  ): Promise<Attribute[]>;
}

// Create a named return type for the mixin
export type AttributableMixin<TSpec extends AttributeSpec, TBase extends AnyConstructor<BaseModel>> = TBase &
  AnyConstructor<AttributableInterface<TSpec>>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Attributable<TSpec extends AttributeSpec, TBase extends AnyConstructor<BaseModel>>(
  base: TBase
): AttributableMixin<TSpec, TBase> {
  abstract class AttributableClass
    extends base
    implements AttributableInterface<TSpec>
  {
    @embed(Attribute, { cardinality: "many", default: () => [] })
    accessor attributes!: EmbedMany<Attribute>;

    // Allow specific types to be inferred from subclass implementations
    public readonly Attributes!: TSpec;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);
    }

    /**
     * Private helper to check if a value is valid for an attribute without throwing.
     * Returns true if valid, false if invalid.
     */
    private _isValidValue<K extends keyof TSpec>(
      name: K,
      value: unknown
    ): value is AttributeValue<TSpec, K> {
      const spec = this.Attributes?.[name as string];
      if (!spec) {
        return false;
      }

      const [typeDefinition] = spec;

      // Handle scalar types
      if (typeDefinition === String && typeof value === 'string') return true;
      if (typeDefinition === Number && typeof value === 'number') return true;
      if (typeDefinition === Boolean && typeof value === 'boolean') return true;
      if (typeDefinition === Date && value instanceof Date) return true;
      if (typeDefinition === UniqueID && value instanceof UniqueID) return true;

      // Handle complex types with validate method
      if (typeof typeDefinition === 'object' && 'validate' in typeDefinition) {
        const complexType = typeDefinition as ComplexAttributeType<unknown>;
        return complexType.validate(value);
      }

      return false;
    }

    /**
     * Private helper to validate attribute values against their spec.
     * Throws an error if validation fails.
     */
    private _validateValue<K extends keyof TSpec>(
      name: K,
      value: unknown
    ): asserts value is AttributeValue<TSpec, K> {
      const spec = this.Attributes?.[name as string];
      if (!spec) {
        throw new BaseError(
          `Attribute "${String(name)}" is not defined in the AttributeSpec for model "${this.constructor.name}".`
        );
      }

      if (!this._isValidValue(name, value)) {
        const [typeDefinition] = spec;
        throw new BaseError(
          `Value for attribute "${String(name)}" failed validation for ${
            typeof typeDefinition === 'function' ? typeDefinition.name.toLowerCase() : 'complex'
          } type.`
        );
      }
    }

    /**
     * Private helper to compare attribute values, handling special cases
     * like UniqueID, Date, and complex objects.
     */
    private _compareValues(v: unknown, target: unknown): boolean {
      if (v instanceof UniqueID && target instanceof UniqueID) {
        return v.equals(target);
      }
      if (v instanceof Date && target instanceof Date) {
        return v.getTime() === target.getTime();
      }
      // For complex objects, use JSON comparison as baseline
      if (typeof v === 'object' && v !== null && typeof target === 'object' && target !== null) {
        try {
          return JSON.stringify(v) === JSON.stringify(target);
        } catch {
          return false;
        }
      }
      return v === target;
    }

    // Use the generic TSpec type for proper type inference
    async setAttribute<K extends keyof TSpec>(
      name: K,
      value: AttributeValue<TSpec, K>
    ): Promise<void> {
      // Validate the value first
      this._validateValue(name, value);

      const collection = await this.attributes();
      const allCurrent = await collection.toArray();
      const attributes = this.Attributes || {};
      const spec = attributes[name as string];
      const isSingle = spec && spec[1] === "single";

      const newAttribute = await Attribute.create({
        name: name as string,
        value: value as string | number | boolean | Date | UniqueID | object,
        created: new Date(),
      });

      const filtered = allCurrent.filter((attr) => {
        if (attr.name !== name) return true; 
        if (isSingle) return false; 
        return !this._compareValues(attr.value, value);
      });

      await this.attributes([...filtered, newAttribute]);
    }

    // Use the generic TSpec type for proper type inference
    async getAttribute<K extends keyof TSpec>(
      name: K
    ): Promise<GetAttributeReturn<TSpec, K>> {
      const collection = await this.attributes();
      const allCurrent = await collection.toArray();
      const spec = this.Attributes?.[name as string];

      if (!spec) {
        throw new BaseError(
          `Attribute "${String(
            name
          )}" is not defined in the AttributeSpec for model "${
            this.constructor.name
          }".`
        );
      }

      const [, cardinality] = spec;

      const rawValues = allCurrent
        .filter((attr) => attr.name === name)
        .map((attr) => attr.value);

      // Validate each value against the spec using our helper
      const validatedValues = rawValues.filter((value) => 
        this._isValidValue(name, value)
      );

      if (cardinality === "single") {
        return validatedValues[0] as GetAttributeReturn<TSpec, K>;
      }

      return validatedValues as GetAttributeReturn<TSpec, K>;
    }

    // Use the generic TSpec type for proper type inference
    async hasAttribute<K extends keyof TSpec>(
      name: K,
      value?: AttributeValue<TSpec, K>
    ): Promise<boolean> {
      const values = await this.getAttribute(name);
      if (value === undefined) {
        return Array.isArray(values) ? values.length > 0 : values !== undefined;
      }

      if (Array.isArray(values)) {
        return values.some((v) => this._compareValues(v, value));
      } else {
        return this._compareValues(values, value);
      }
    }

    // Use the generic TSpec type for proper type inference
    async deleteAttribute<K extends keyof TSpec>(
      name: K,
      value?: AttributeValue<TSpec, K>
    ): Promise<void> {
      const collection = await this.attributes();
      const allCurrent = await collection.toArray();

      const remaining = allCurrent.filter((attr) => {
        if (attr.name !== name) return true;
        if (value !== undefined) {
          return !this._compareValues(attr.value, value);
        }
        return false;
      });

      await this.attributes(remaining);
    }

    // Use the generic TSpec type for proper type inference
    async getRawAttributes<K extends keyof TSpec>(
      name?: K
    ): Promise<Attribute[]> {
      const collection = await this.attributes();
      const allCurrent = await collection.toArray();
      
      if (name === undefined) return allCurrent;

      return allCurrent.filter((attr) => attr.name === name);
    }
  }

  return AttributableClass as AttributableMixin<TSpec, TBase>;
}
