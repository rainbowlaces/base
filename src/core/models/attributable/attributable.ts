import { type BaseModel } from "../baseModel.js";
import { embed } from "../decorators/embed.js";
import { type EmbedMany } from "../types.js";
import { Attribute } from "./attribute.js";
import { UniqueID } from "../uniqueId.js";
import {
  type AttributeSpec,
  type AttributeValue,
  type GetAttributeReturn,
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

    // Use the generic TSpec type for proper type inference
    async setAttribute<K extends keyof TSpec>(
      name: K,
      value: AttributeValue<TSpec, K>
    ): Promise<void> {
      const collection = await this.attributes();
      const allCurrent = await collection.toArray();
      const attributes = this.Attributes || {};
      const spec = attributes[name as string];
      const isSingle = spec && spec[1] === "single";

      const newAttribute = await Attribute.create({
        name: name as string,
        value: value as string | number | boolean | Date | UniqueID,
        created: new Date(),
      });
      const compareValues = (v: unknown, target: unknown): boolean => {
        if (v instanceof UniqueID && target instanceof UniqueID) {
          return v.equals(target);
        }
        if (v instanceof Date && target instanceof Date) {
          return v.getTime() === target.getTime();
        }
        return v === target;
      };

      const filtered = allCurrent.filter((attr) => {
        if (attr.name !== name) return true; 
        if (isSingle) return false; 
        return !compareValues(attr.value, value);
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

      const [typeConstructor, cardinality] = spec;

      const values = allCurrent
        .filter((attr) => attr.name === name)
        .map((attr) => attr.value)
        .filter((value) => {
          if (typeConstructor === String) return typeof value === "string";
          if (typeConstructor === Number) return typeof value === "number";
          if (typeConstructor === Boolean) return typeof value === "boolean";
          if (typeConstructor === Date) return value instanceof Date;
          if (typeConstructor === UniqueID) return value instanceof UniqueID;
          return false;
        });

      if (cardinality === "single") {
        return values[0] as GetAttributeReturn<TSpec, K>;
      }

      return values as GetAttributeReturn<TSpec, K>;
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
        return values.some((v) => compareValues(v, value));
      } else {
        return compareValues(values, value);
      }
    }

    // Use the generic TSpec type for proper type inference
    async deleteAttribute<K extends keyof TSpec>(
      name: K,
      value?: AttributeValue<TSpec, K>
    ): Promise<void> {
      const collection = await this.attributes();
      const allCurrent = await collection.toArray();

      const compareValues = (v: unknown, target: unknown): boolean => {
        if (v instanceof UniqueID && target instanceof UniqueID) {
          return v.equals(target);
        }
        if (v instanceof Date && target instanceof Date) {
          return v.getTime() === target.getTime();
        }
        return v === target;
      };

      const remaining = allCurrent.filter((attr) => {
        if (attr.name !== name) return true;
        if (value !== undefined) {
          return !compareValues(attr.value, value);
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
