/**
 * BaseModel - Final Model Class
 * 
 * The complete model class that brings together all layers of functionality.
 * This is the class that application models should extend.
 * 
 * Inheritance Chain:
 * BaseModelCore → BaseModelRelations → BaseModelPersistence → BaseModel
 * 
 * This layer provides:
 * - Static schema management methods
 * - Static factory methods (fromData, create)
 * - Model registration hooks
 * 
 * All instance methods (get, set, save, remove, appendToArray, etc.) are
 * inherited from the parent layers.
 * 
 * Note: Type errors in intermediate layer files (BaseModelCore, etc.) are expected
 * and don't affect runtime behavior. They occur because TypeScript can't see the
 * full inheritance chain until this final class is defined.
 */

import { BaseModelPersistence } from "./baseModelPersistence.js";
import {
  type BaseModelSchema,
  type ModelMetadata,
  type FieldMetadata,
  type NoDerivedModelData,
  type ModelData,
  type IBaseModel,
} from "./types.js";

export type BaseModelClass = typeof BaseModel;

/**
 * Abstract base class for all models.
 * Provides schema management, field definitions, and factory methods.
 * 
 * Instance methods are inherited from:
 * - BaseModelCore: get, set, has, serialize, hydrate, etc.
 * - BaseModelRelations: appendToArray, getFromMap, setInArray, etc.
 * - BaseModelPersistence: save, remove, event publishing
 */
export abstract class BaseModel extends BaseModelPersistence implements IBaseModel {
  private static readonly modelSchemaKey = Symbol("modelSchema");

  // =============================================================================
  // STATIC SCHEMA MANAGEMENT
  // =============================================================================

  /**
   * Deep clones an object while preserving functions.
   * Used for schema inheritance to avoid shared references between parent and child schemas.
   */
  private static _cloneWithFunctions<T>(source: T): T {
    if (typeof source !== "object" || source === null) {
      return source;
    }

    const clone = (Array.isArray(source) ? [] : {}) as T;

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        (clone as Record<string, unknown>)[key] = this._cloneWithFunctions(
          (source as Record<string, unknown>)[key]
        );
      }
    }

    return clone;
  }

  /**
   * Gets or initializes the schema for a model class.
   * Handles schema inheritance from parent classes.
   */
  private static getOrInitSchema(
    constructor: typeof BaseModel
  ): BaseModelSchema {
    if (
      !Object.prototype.hasOwnProperty.call(constructor, this.modelSchemaKey)
    ) {
      const parentConstructor = Object.getPrototypeOf(constructor) as Record<
        symbol,
        BaseModelSchema
      > | null;
      let newSchema: BaseModelSchema = { fields: {}, meta: {} };

      if (parentConstructor?.[this.modelSchemaKey]) {
        const parentSchema = parentConstructor[this.modelSchemaKey];
        newSchema = this._cloneWithFunctions(parentSchema);
      }

      Object.defineProperty(constructor, this.modelSchemaKey, {
        value: newSchema,
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
    return (constructor as unknown as Record<symbol, BaseModelSchema>)[
      this.modelSchemaKey
    ];
  }

  /**
   * Private method for decorators to add a key-value pair to the model's metadata.
   * Decorators should access this via (target as any).setMetaValue()
   * 
   * @internal
   */
  private static setMetaValue<K extends keyof ModelMetadata>(
    key: K,
    value: ModelMetadata[K]
  ) {
    const schema = BaseModel.getOrInitSchema(this);
    schema.meta[key] = value;
  }

  /**
   * Private method for decorators to add field metadata.
   * Decorators should access this via (target as any).addField()
   * 
   * @internal
   */
  private static addField(propertyName: string, meta: FieldMetadata) {
    const schema = BaseModel.getOrInitSchema(this);
    schema.fields[propertyName] = meta;
  }

  /**
   * Gets the processed schema for this model class.
   * This is the public API for accessing the schema at runtime.
   */
  public static getProcessedSchema(): BaseModelSchema {
    return BaseModel.getOrInitSchema(this);
  }

  /**
   * Hook method called after a model is registered with the @model decorator.
   * Subclasses can override this to perform custom initialization based on the schema.
   * This is called once per model class during the decorator application phase.
   */
  protected static onModelRegistered(): void {
    // Default implementation does nothing
    // Subclasses can override to add custom logic like schema validation
  }

  // =============================================================================
  // STATIC FACTORY METHODS
  // =============================================================================

  /**
   * Static factory method to create a model instance pre-populated with data.
   * This provides a clean public interface for model instantiation.
   * Use this for hydrating existing data (e.g., from database).
   * 
   * @param data - The data to hydrate the model with
   * @returns A new model instance with the data hydrated
   */
  public static async fromData<T extends BaseModel>(
    this: new () => T,
    data: NoDerivedModelData<T>
  ): Promise<T> {
    const instance = new this();
    await instance.hydrate(data);
    return instance;
  }

  /**
   * Static factory method to create a NEW model instance that will be persisted.
   * This marks the model as new and dirty, so it will be saved when save() is called.
   * Use this when creating new entities that need to be persisted.
   * 
   * @param data - Optional initial data for the model
   * @returns A new model instance marked as new
   */
  public static async create<T extends BaseModel>(
    this: new () => T,
    data: ModelData<T> = {} as ModelData<T>
  ): Promise<T> {
    const instance = new this();
    await instance.hydrate(data, true); // Pass true to mark as new
    return instance;
  }
}
