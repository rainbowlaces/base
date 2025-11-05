/**
 * BaseModelCore - Core Data Management Layer
 * 
 * Handles the fundamental data storage, state management, and serialization.
 * This is the foundation layer with no knowledge of relations, persistence, or events.
 * 
 * Responsibilities:
 * - Private state management (#data, #originalData, #dirty, #new)
 * - Field accessors (get, set, unset, has, defined)
 * - Hydration and serialization
 * - Lifecycle hooks (beforeSet, beforeGet, etc.)
 * - Smart dirty tracking
 * 
 * Note: Type errors in this file are expected due to circular dependencies with BaseModel.
 * The final BaseModel class extends this, resolving all type constraints at runtime.
 */

import { BaseError } from "../baseErrors.js";
import {
  type FieldOptions,
  type BaseModelSchema,
  type IBaseModelConstructor,
} from "./types.js";
import { serialize } from "../../utils/serialization.js";
import { 
  toUniqueIdAsync, 
  toUniqueIdsAsync,
  type AsyncDefinedId,
  type AsyncDefinedIds,
  type Identifiable,
} from "./utils.js";
import { BaseModelCollection } from "./baseModelCollection.js";

// Note: BaseModel will extend this class, completing the inheritance chain.
// Type safety is provided through IBaseModel interface, avoiding circular dependencies.

/**
 * Core data management layer for models.
 * Provides the fundamental infrastructure for storing, accessing, and serializing data.
 */
export abstract class BaseModelCore {
  #data: Record<string, unknown> = {};
  #originalData: Record<string, unknown> = {};
  #dirty: boolean = false;
  #new: boolean = true;

  constructor() {
    this.setDefaults();
    this.init();
  }

  /**
   * Initialization hook called after construction.
   * Override in subclasses for custom initialization logic.
   */
  protected init() {
    // Override in subclasses
  }

  /**
   * Sets default values for fields that define a default option.
   * Called during construction to initialize the model.
   */
  private setDefaults() {
     
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();

    for (const key in schema.fields) {
      const fieldMeta = schema.fields[key];
      if (fieldMeta.options.default) {
        const val =
          typeof fieldMeta.options.default === "function"
            ? (fieldMeta.options.default as (this: unknown) => unknown).call(
                this
              )
            : fieldMeta.options.default;
        this.#data[key] = val;
        this.#originalData[key] = val;
      }
    }
  }

  /**
   * Gets the model's dirty state.
   * A model is dirty if it has unsaved changes, or if it's new.
   */
  public get dirty(): boolean {
    if (this.#new) return true;
    return this.#dirty;
  }

  /**
   * Explicitly mark the model as dirty (having unsaved changes).
   */
  public markAsDirty(): void {
    this.#dirty = true;
  }

  // =============================================================================
  // PROTECTED STATE API (for child class use)
  // =============================================================================

  /**
   * Checks the model's 'new' status.
   * @returns true if the model is new (not yet persisted).
   */
  protected isNew(): boolean {
    return this.#new;
  }

  /**
   * Sets the model's 'new' status.
   * Called by BaseModelPersistence after a successful save.
   */
  protected setNew(isNew: boolean): void {
    this.#new = isNew;
  }

  /**
   * Sets the model's 'dirty' status.
   * Called by BaseModelPersistence after a successful save or revert.
   */
  protected setDirty(isDirty: boolean): void {
    this.#dirty = isDirty;
  }

  /**
   * Gets the current internal data object.
   * Used to snapshot the data for `setOriginalData`.
   */
  protected getData(): Record<string, unknown> {
    return this.#data;
  }

  /**
   * Sets the internal 'originalData' snapshot.
   * Called by BaseModelPersistence after a successful save to lock in the new state.
   */
  protected setOriginalData(data: Record<string, unknown>): void {
    this.#originalData = data;
  }

  /**
   * Hydrates the model with data, typically from a database or API.
   * Handles relationship data, field-level hydrators, and validators.
   */
  protected async hydrate(
    data: Record<string, unknown>,
    isNew: boolean = false
  ): Promise<void> {
     
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();

    for (const key in schema.fields) {
      if (key in data && data[key] !== undefined) {
        const rawValue = data[key];
        const fieldMeta = schema.fields[key];
        let processedValue = rawValue;

        // --- RELATIONSHIP HYDRATION ---
        if (fieldMeta.relation && rawValue != null) {
          const isMany = fieldMeta.relation.cardinality === "many";
          const isMap = isMany && fieldMeta.relation.structure === "map";
          const isArray = isMany && (!fieldMeta.relation.structure || fieldMeta.relation.structure === "array");
          const items =
            isArray && !Array.isArray(rawValue) ? [rawValue] : rawValue;

          if (fieldMeta.relation.type === "reference") {
            if (isMany) {
              processedValue = await toUniqueIdsAsync(items as AsyncDefinedIds<Identifiable>);
            } else {
              processedValue = await toUniqueIdAsync(items as AsyncDefinedId<Identifiable>);
            }
          } else if (fieldMeta.relation.type === "embed") {
            const serializeItem = (item: unknown): unknown =>
              (item && typeof item === 'object' && 'serialize' in item && typeof item.serialize === 'function')
                ? item.serialize()
                : item;

            if (isMap) {
              const mapData: Record<string, unknown> = rawValue instanceof Map ? 
                Object.fromEntries(rawValue.entries()) : rawValue as Record<string, unknown>;
              const serializedMap: Record<string, unknown> = {};
              for (const [key, item] of Object.entries(mapData)) {
                serializedMap[key] = serializeItem(item);
              }
              processedValue = serializedMap;
            } else if (isArray) {
              const collection =
                items instanceof BaseModelCollection
                  ? await items.toArray()
                  : items;
              processedValue = Array.isArray(collection) 
                ? collection.map(serializeItem)
                : [];
            } else {
              processedValue = serializeItem(items) ?? null;
            }
          }
        }

        // --- FIELD-LEVEL HYDRATOR ---
        if (fieldMeta.options.hydrator) {
          processedValue = fieldMeta.options.hydrator.apply(this, [
            processedValue,
          ]);
        }

        // --- FIELD-LEVEL VALIDATOR ---
        if (fieldMeta.options.validator) {
          try {
            fieldMeta.options.validator.apply(this, [processedValue]);
          } catch (error: Error | unknown) {
            throw new BaseError(
              `Validation failed for field "${key}" during hydration`,
              error as Error
            );
          }
        }

        this.#originalData[key] = processedValue;
        this.#data[key] = processedValue;
      }
    }
    this.#dirty = false;
    this.#new = isNew;
  }

  /**
   * Resets the model to a clean, new state.
   * Clears all data and re-applies defaults.
   */
  public reset() {
    this.#new = true;
    this.#dirty = false;
    this.#data = {};
    this.#originalData = {};
    this.setDefaults();
  }

  /**
   * Gets metadata for a field from the schema.
   * Throws if the field is not defined.
   */
  private getMeta(key: string): {
    constructor: IBaseModelConstructor;
    fieldOptions: FieldOptions;
  } {
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const fieldMeta = schema.fields[key];

    if (!fieldMeta) {
      throw new BaseError(`Field "${key}" is not defined in the schema.`);
    }
    return { constructor, fieldOptions: fieldMeta.options };
  }

  /**
   * Determines if a value is a scalar type that can be safely compared with ===
   */
  private isScalarValue(value: unknown): boolean {
    const type = typeof value;
    return (
      value === null ||
      value === undefined ||
      type === "string" ||
      type === "number" ||
      type === "boolean" ||
      value instanceof Date
    );
  }

  /**
   * Compares two values to determine if they are effectively equal.
   * For scalar values, uses strict equality. For complex types, always returns false (assumes dirty).
   */
  private valuesEqual(oldValue: unknown, newValue: unknown): boolean {
    if (this.isScalarValue(oldValue) && this.isScalarValue(newValue)) {
      return oldValue === newValue;
    }
    return false;
  }

  /**
   * Unsets a field, marking it as undefined.
   * The model becomes dirty after this operation.
   */
  public unset(key: string): boolean {
    const { fieldOptions } = this.getMeta(key);
    if (!(key in this.#data)) {
      throw new BaseError(`Field "${key}" is not set.`);
    }
    if (!this.beforeUnset(key, fieldOptions)) return false;
    this.#dirty = true;
    this.#data[key] = undefined;
    return true;
  }

  /**
   * Gets the value of a field.
   * Returns undefined if the field is not set.
   */
  public get<K extends string>(
    key: K
  ): unknown {
    const { fieldOptions } = this.getMeta(key);
    if (!(key in this.#data)) {
      return undefined;
    }
    return this.beforeGet(
      key,
      this.#data[key],
      fieldOptions
    );
  }

  /**
   * Internal method for decorator use - bypasses type checking.
   * @internal
   */
  protected _internalGet<T>(key: string): T {
    const { fieldOptions } = this.getMeta(key);
    if (!(key in this.#data)) {
      return undefined as T;
    }
    return this.beforeGet(key, this.#data[key], fieldOptions) as T;
  }

  /**
   * Internal method for decorator use - bypasses type checking.
   * @internal
   */
  protected _internalSet<T>(key: string, value: T): void {
    const { fieldOptions } = this.getMeta(key);
    if (fieldOptions.readOnly && !this.#new) {
      throw new BaseError(
        `Readonly field "${key}" cannot be changed on an existing model.`
      );
    }

    let convertedValue = value;
    if (fieldOptions.hydrator) {
      convertedValue = fieldOptions.hydrator.apply(this, [value]) as T;
    }

    if (fieldOptions.validator) {
      try {
        fieldOptions.validator.apply(this, [convertedValue]);
      } catch (_error) {
        throw new BaseError(`Validation failed for field "${key}"`);
      }
    }

    if (!this.beforeSet(key, convertedValue, fieldOptions)) return;

    const currentValue = this.#data[key];
    if (
      !(key in this.#data) ||
      !this.valuesEqual(currentValue, convertedValue)
    ) {
      this.#dirty = true;
    }

    this.#data[key] = convertedValue;
  }

  /**
   * Sets the value of a field.
   * Triggers hydration, validation, and dirty tracking.
   */
  public set<K extends string>(
    key: K,
    value: unknown
  ): void {
    const { fieldOptions } = this.getMeta(key);
    if (fieldOptions.readOnly) {
      throw new BaseError(`Field "${key}" is readonly and cannot be set.`);
    }

    let convertedValue = value;
    if (fieldOptions.hydrator) {
      convertedValue = fieldOptions.hydrator.apply(this, [
        value,
      ]);
    }

    if (fieldOptions.validator) {
      try {
        fieldOptions.validator.apply(this, [convertedValue]);
      } catch (_error) {
        throw new BaseError(`Validation failed for field "${key}"`);
      }
    }

    if (!this.beforeSet(key, convertedValue, fieldOptions)) return;

    const currentValue = this.#data[key];
    if (
      !(key in this.#data) ||
      !this.valuesEqual(currentValue, convertedValue)
    ) {
      this.#dirty = true;
    }

    this.#data[key] = convertedValue;
  }

  /**
   * Checks if a field has a value (is defined and not undefined).
   */
  public has(key: string): boolean {
    return (
      this.defined(key) && key in this.#data && this.#data[key] !== undefined
    );
  }

  /**
   * Checks if a field is defined in the schema.
   */
  public defined(key: string): boolean {
    try {
       
      const constructor = this.constructor as IBaseModelConstructor;
      const schema = constructor.getProcessedSchema();
      return key in schema.fields;
    } catch {
      return false;
    }
  }

  // --- LIFECYCLE HOOKS ---

  /**
   * Hook called before unsetting a field.
   * Return false to prevent the unset operation.
   */
  protected beforeUnset(_key: string, _schema: FieldOptions): boolean {
    return true;
  }

  /**
   * Hook called before setting a field value.
   * Return false to prevent the set operation.
   */
  protected beforeSet<T>(
    _key: string,
    _value: T,
    _schema: FieldOptions
  ): boolean {
    return true;
  }

  /**
   * Hook called before getting a field value.
   * Can transform the value before returning it.
   */
  protected beforeGet<T>(
    _key: string,
    _value: T,
    _schema: FieldOptions
  ): T | undefined {
    return _value;
  }

  /**
   * Hook called before checking if a field exists.
   * Return false to prevent the has operation.
   */
  protected beforeHas(_key: string, _schema: FieldOptions): boolean {
    return true;
  }

  // --- SERIALIZATION ---

  /**
   * Serializes a single field value using its configured serializer or default logic.
   */
  private serializeField(
    key: string,
    value: unknown,
    schema: BaseModelSchema
  ): unknown {
    const serializer = schema.fields[key].options.serializer;
    if (serializer && typeof serializer === "function") {
      return serializer.apply(this, [value]);
    } else {
      return serialize(value);
    }
  }

  /**
   * Serializes the model to a plain object representation.
   */
   
  public serialize(): Record<string, unknown> {
     
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const data: Record<string, unknown> = {};
    for (const key in schema.fields) {
      if (this.has(key)) {
        const value = this.serializeField(key, this.get(key), schema);
        if (value === undefined) continue;
        data[key] = value;
      }
    }

    return data;
  }

  /**
   * Reverts the model to its last saved state.
   * Only works if the model has unsaved changes.
   */
  public revert(): void {
    if (!this.dirty) return;
    this.#data = { ...this.#originalData };
    this.#dirty = false;
  }
}
