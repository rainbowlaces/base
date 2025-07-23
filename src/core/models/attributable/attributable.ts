import { type BaseModel } from "../baseModel.js";
import { embed } from "../decorators/embed.js";
import { type EmbedMany } from "../types.js";
import { Attribute } from "./attribute.js";
import { UniqueID } from "../uniqueId.js";
import {
  type AttributeValue,
  type GetAttributeReturn,
} from "../types.js";
import { BaseError } from "../../baseErrors.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConstructor<T = object> = abstract new (...args: any[]) => T;

// Define the public interface for attributable functionality
export interface AttributableInterface {
  attributes: EmbedMany<Attribute>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly Attributes: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setAttribute<K extends keyof any>(
    name: K,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any
  ): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAttribute<K extends keyof any>(
    name: K
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hasAttribute<K extends keyof any>(
    name: K,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value?: any
  ): Promise<boolean>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deleteAttribute<K extends keyof any>(
    name: K,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value?: any
  ): Promise<void>;
}

// Create a named return type for the mixin
export type AttributableMixin<TBase extends AnyConstructor<BaseModel>> = TBase &
  AnyConstructor<AttributableInterface>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Attributable<TBase extends AnyConstructor<BaseModel>>( Base: TBase ): AttributableMixin<TBase> {
  abstract class AttributableClass
    extends Base
    implements AttributableInterface
  {
    @embed(Attribute, { cardinality: "many", default: () => [] })
    accessor attributes!: EmbedMany<Attribute>;

    // Allow specific types to be inferred from subclass implementations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public readonly Attributes!: any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);
    }

    async setAttribute<K extends keyof this["Attributes"]>(
      name: K,
      value: AttributeValue<this["Attributes"], K>
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

    async getAttribute<K extends keyof this["Attributes"]>(
      name: K
    ): Promise<GetAttributeReturn<this["Attributes"], K>> {
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
        }) as AttributeValue<this["Attributes"], K>[];

      if (cardinality === "single") {
        return values[0] as GetAttributeReturn<this["Attributes"], K>;
      }

      return values as GetAttributeReturn<this["Attributes"], K>;
    }

    async hasAttribute<K extends keyof this["Attributes"]>(
      name: K,
      value?: AttributeValue<this["Attributes"], K>
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

    async deleteAttribute<K extends keyof this["Attributes"]>(
      name: K,
      value?: AttributeValue<this["Attributes"], K>
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
  }

  return AttributableClass as AttributableMixin<TBase>;
}
