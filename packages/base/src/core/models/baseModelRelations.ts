/**
 * BaseModelRelations - Array and Map Helper Layer
 * 
 * Provides convenient methods for working with collection-based relations.
 * This layer adds a "decent API" for arrays and maps without knowing about persistence.
 * 
 * Responsibilities:
 * - Array helpers (appendToArray, getFromArray, setInArray, deleteFromArray, etc.)
 * - Map helpers (setInMap, getFromMap, deleteFromMap, hasInMap, etc.)
 * - Collection manipulation for embedMany, refMany, embedMap relations
 * 
 * Inheritance: BaseModelCore → BaseModelRelations → BaseModelPersistence → BaseModel
 * 
 * Note: Some 'any' types are necessary here to avoid circular dependencies with BaseModel.
 * Type safety is restored when BaseModel extends this class.
 */

import { BaseError } from "../baseErrors.js";
import { BaseModelCore } from "./baseModelCore.js";
import { UniqueID } from "./uniqueId.js";
import {
  type ModelData,
  type IBaseModelConstructor,
  type IBaseModel,
} from "./types.js";
import { resolve } from "../../utils/thunk.js";

// Note: BaseModel extends this class, completing the inheritance chain.
// Type safety is provided through IBaseModel interface, avoiding circular dependencies.

// Flexible type for appendTo that supports both reference and embed relations
type AppendToItem =
  | string
  | UniqueID
  | { id: UniqueID }
  | unknown;

type AppendToItems = AppendToItem | AppendToItem[];

/**
 * Relation helper layer providing collection manipulation methods.
 * Extends BaseModelCore with convenient APIs for arrays and maps.
 */
export abstract class BaseModelRelations extends BaseModelCore {
  
  // =============================================================================
  // ARRAY HELPERS
  // =============================================================================

  /**
   * Append items to an embedMany or refMany field.
   * 
   * @param relationName - The name of the many relationship field
   * @param itemsToAdd - Item(s) to append (model instances, IDs, or serialized data)
   * @deprecated Use appendToArray instead for consistency with other array helper methods
   */
  protected async appendTo<K extends keyof this & string>(
    relationName: K,
    itemsToAdd: AppendToItems
  ): Promise<void> {
    return this.appendToArray(relationName, itemsToAdd);
  }

  /**
   * Append items to an embedMany or refMany field.
   * 
   * @param relationName - The name of the many relationship field
   * @param itemsToAdd - Item(s) to append (model instances, IDs, or serialized data)
   */
  protected async appendToArray<K extends keyof this & string>(
    relationName: K,
    itemsToAdd: AppendToItems
  ): Promise<void> {
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const fieldMeta = schema.fields[relationName];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = fieldMeta?.options as any;
    const isMany = fieldMeta?.relation?.cardinality === "many" || 
                   options?.cardinality === "many";

    if (!fieldMeta || !isMany) {
      throw new BaseError(
        `'appendToArray' can only be used on a 'many' relationship field.`
      );
    }

    const currentRawData = (this.get(relationName) as unknown[]) || [];

    const resolvedItems = await Promise.resolve(itemsToAdd);
    const items = Array.isArray(resolvedItems) ? resolvedItems : [resolvedItems];
    let newRawItems: unknown[];

    const relationType = fieldMeta.relation?.type || "embed";

    if (relationType === "reference") {
      newRawItems = await Promise.all(items.map(async (item) => {
        const resolvedItem = await Promise.resolve(item);
        
        if (typeof resolvedItem === 'string') {
          return new UniqueID(resolvedItem);
        } else if (resolvedItem instanceof UniqueID) {
          return resolvedItem;
        } else if (resolvedItem && typeof resolvedItem === 'object' && 'id' in resolvedItem) {
          const hasId = resolvedItem as { id: UniqueID };
          return hasId.id;
        } else {
          throw new BaseError(
            "Cannot append a non-identifiable item to a reference relation."
          );
        }
      }));
    } else {
      newRawItems = await Promise.all(items.map(async (item) => {
        const resolvedItem = await Promise.resolve(item);
        
        if (resolvedItem && typeof resolvedItem === 'object' && 'serialize' in resolvedItem) {
          const model = resolvedItem as IBaseModel;
          return model.serialize();
        } else {
          return resolvedItem;
        }
      }));
    }

    const newRawData = [...currentRawData, ...newRawItems];
    this.set(relationName, newRawData);
  }

  /**
   * Get a specific item from an embedMany field by index, returning a hydrated model.
   * 
   * @param fieldKey - The name of the embedMany field
   * @param index - The index of the item to retrieve
   * @returns The hydrated model instance, or undefined if index is out of bounds
   */
  protected async getFromArray<K extends keyof this & string, T extends IBaseModel>(
    fieldKey: K,
    index: number
  ): Promise<T | undefined> {
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const fieldMeta = schema.fields[fieldKey as string];

    if (!fieldMeta) {
      throw new BaseError(`Field '${fieldKey}' is not defined in the schema.`);
    }

    const isArray = fieldMeta.relation?.cardinality === 'many' && 
                    (!fieldMeta.relation.structure || fieldMeta.relation.structure === 'array');

    if (!isArray) {
      throw new BaseError(`'getFromArray' can only be used on an 'embedMany' or 'refMany' field with array structure.`);
    }

    const currentData = (this.get(fieldKey as string) as Array<ModelData<IBaseModel> | UniqueID>) || [];
    
    if (index < 0 || index >= currentData.length) {
      return undefined;
    }

    const item = currentData[index];

    if (fieldMeta.relation?.type === 'reference') {
      return item as unknown as T;
    }

    const modelConstructor = resolve(fieldMeta.relation!.model);

    const hydratedModel = await modelConstructor.fromData(item as Record<string, unknown>);
    
    return hydratedModel as T;
  }

  /**
   * Set or update a specific item in an embedMany field by index.
   * 
   * @param fieldKey - The name of the embedMany field
   * @param index - The index of the item to update
   * @param value - The model instance or serialized data to store
   */
  protected setInArray<K extends keyof this & string, T extends IBaseModel>(
    fieldKey: K,
    index: number,
    value: T | ModelData<T>
  ): void {
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const fieldMeta = schema.fields[fieldKey as string];

    if (!fieldMeta) {
      throw new BaseError(`Field '${fieldKey}' is not defined in the schema.`);
    }

    const isArray = fieldMeta.relation?.cardinality === 'many' && 
                    (!fieldMeta.relation.structure || fieldMeta.relation.structure === 'array');

    if (!isArray) {
      throw new BaseError(`'setInArray' can only be used on an 'embedMany' or 'refMany' field with array structure.`);
    }

    const currentData = (this.get(fieldKey as string) as unknown[]) || [];
    
    if (index < 0 || index >= currentData.length) {
      throw new BaseError(`Index ${index} is out of bounds for array with length ${currentData.length}.`);
    }

    let serializedValue: unknown;
    if (value && typeof value === 'object' && 'serialize' in value) {
      serializedValue = (value as IBaseModel).serialize();
    } else {
      serializedValue = value;
    }

    const updatedData = [...currentData];
    updatedData[index] = serializedValue;
    
    this.set(fieldKey, updatedData);
  }

  /**
   * Delete a specific item from an embedMany field by index.
   * 
   * @param fieldKey - The name of the embedMany field
   * @param index - The index of the item to delete
   * @returns true if the item was deleted, false if index was out of bounds
   */
  protected deleteFromArray<K extends keyof this & string>(
    fieldKey: K,
    index: number
  ): boolean {
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const fieldMeta = schema.fields[fieldKey as string];

    if (!fieldMeta) {
      throw new BaseError(`Field '${fieldKey}' is not defined in the schema.`);
    }

    const isArray = fieldMeta.relation?.cardinality === 'many' && 
                    (!fieldMeta.relation.structure || fieldMeta.relation.structure === 'array');

    if (!isArray) {
      throw new BaseError(`'deleteFromArray' can only be used on an 'embedMany' or 'refMany' field with array structure.`);
    }

    const currentData = (this.get(fieldKey as string) as unknown[]) || [];
    
    if (index < 0 || index >= currentData.length) {
      return false;
    }

    const updatedData = [...currentData.slice(0, index), ...currentData.slice(index + 1)];
    
    this.set(fieldKey, updatedData);
    
    return true;
  }

  /**
   * Check if a specific index exists in an embedMany field.
   * 
   * @param fieldKey - The name of the embedMany field
   * @param index - The index to check
   * @returns true if the index exists, false otherwise
   */
  protected hasInArray<K extends keyof this & string>(
    fieldKey: K,
    index: number
  ): boolean {
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const fieldMeta = schema.fields[fieldKey as string];

    if (!fieldMeta) {
      throw new BaseError(`Field '${fieldKey}' is not defined in the schema.`);
    }

    const isArray = fieldMeta.relation?.cardinality === 'many' && 
                    (!fieldMeta.relation.structure || fieldMeta.relation.structure === 'array');

    if (!isArray) {
      throw new BaseError(`'hasInArray' can only be used on an 'embedMany' or 'refMany' field with array structure.`);
    }

    const currentData = (this.get(fieldKey as string) as unknown[]) || [];
    
    return index >= 0 && index < currentData.length;
  }

  /**
   * Find the first item in an embedMany field that matches the predicate.
   * 
   * @param fieldKey - The name of the embedMany field
   * @param predicate - Function to test each item
   * @returns The first matching hydrated model, or undefined if not found
   */
  protected async findInArray<K extends keyof this & string, T extends IBaseModel>(
    fieldKey: K,
    predicate: (item: T, index: number) => boolean | Promise<boolean>
  ): Promise<T | undefined> {
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const fieldMeta = schema.fields[fieldKey as string];

    if (!fieldMeta) {
      throw new BaseError(`Field '${fieldKey}' is not defined in the schema.`);
    }

    const isArray = fieldMeta.relation?.cardinality === 'many' && 
                    (!fieldMeta.relation.structure || fieldMeta.relation.structure === 'array');

    if (!isArray) {
      throw new BaseError(`'findInArray' can only be used on an 'embedMany' or 'refMany' field with array structure.`);
    }

    const currentData = (this.get(fieldKey as string) as Array<ModelData<IBaseModel>>) || [];
    
    if (fieldMeta.relation?.type === 'reference') {
      throw new BaseError(`'findInArray' is not supported for reference relations. Use 'filterArray' to get IDs.`);
    }

    const modelConstructor = resolve(fieldMeta.relation!.model);
    
    for (let i = 0; i < currentData.length; i++) {
       
      const hydratedModel = await modelConstructor.fromData(currentData[i] as Record<string, unknown>);
       
      const matches = await Promise.resolve(predicate(hydratedModel as T, i));
      
      if (matches) {
         
        return hydratedModel as T;
      }
    }
    
    return undefined;
  }

  /**
   * Filter items in an embedMany field that match the predicate.
   * 
   * @param fieldKey - The name of the embedMany field
   * @param predicate - Function to test each item
   * @returns Array of matching hydrated models
   */
  protected async filterArray<K extends keyof this & string, T extends IBaseModel>(
    fieldKey: K,
    predicate: (item: T, index: number) => boolean | Promise<boolean>
  ): Promise<T[]> {
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const fieldMeta = schema.fields[fieldKey as string];

    if (!fieldMeta) {
      throw new BaseError(`Field '${fieldKey}' is not defined in the schema.`);
    }

    const isArray = fieldMeta.relation?.cardinality === 'many' && 
                    (!fieldMeta.relation.structure || fieldMeta.relation.structure === 'array');

    if (!isArray) {
      throw new BaseError(`'filterArray' can only be used on an 'embedMany' or 'refMany' field with array structure.`);
    }

    const currentData = (this.get(fieldKey as string) as Array<ModelData<IBaseModel>>) || [];
    
    if (fieldMeta.relation?.type === 'reference') {
      throw new BaseError(`'filterArray' is not supported for reference relations.`);
    }

    const modelConstructor = resolve(fieldMeta.relation!.model);
    const results: T[] = [];
    
    for (let i = 0; i < currentData.length; i++) {
       
      const hydratedModel = await modelConstructor.fromData(currentData[i] as Record<string, unknown>);
       
      const matches = await Promise.resolve(predicate(hydratedModel as T, i));
      
      if (matches) {
         
        results.push(hydratedModel as T);
      }
    }
    
    return results;
  }

  // =============================================================================
  // MAP HELPERS
  // =============================================================================

  /**
   * Set or update a specific entry in an embedMap field.
   * 
   * @param fieldKey - The name of the embedMap field
   * @param mapKey - The key within the map
   * @param value - The model instance or serialized data to store
   */
  protected setInMap<K extends keyof this & string, T extends IBaseModel>(
    fieldKey: K,
    mapKey: string,
    value: T | ModelData<T>
  ): void {
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const fieldMeta = schema.fields[fieldKey as string];

    if (!fieldMeta) {
      throw new BaseError(
        `Field '${fieldKey}' is not defined in the schema.`
      );
    }

    if (!fieldMeta.relation || fieldMeta.relation.structure !== 'map') {
      throw new BaseError(
        `'setInMap' can only be used on an 'embedMap' field.`
      );
    }

    const currentData = (this.get(fieldKey as string) as Record<string, unknown>) || {};

    let serializedValue: unknown;
    if (value && typeof value === 'object' && 'serialize' in value) {
      serializedValue = (value as IBaseModel).serialize();
    } else {
      serializedValue = value;
    }

    const updatedData = { ...currentData, [mapKey]: serializedValue };
    
    this.set(fieldKey, updatedData);
  }

  /**
   * Get a specific entry from an embedMap field, returning a hydrated model.
   * 
   * @param fieldKey - The name of the embedMap field
   * @param mapKey - The key within the map
   * @returns The hydrated model instance, or undefined if not found
   */
  protected async getFromMap<K extends keyof this & string, T extends IBaseModel>(
    fieldKey: K,
    mapKey: string
  ): Promise<T | undefined> {
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const fieldMeta = schema.fields[fieldKey as string];

    if (!fieldMeta?.relation || fieldMeta.relation.structure !== 'map') {
      throw new BaseError(
        `'getFromMap' can only be used on an 'embedMap' field.`
      );
    }

    const currentData = (this.get(fieldKey as string) as Record<string, ModelData<IBaseModel>>) || {};
    
    if (!(mapKey in currentData)) {
      return undefined;
    }

    const modelConstructor = resolve(fieldMeta.relation.model);
     
    const hydratedModel = await modelConstructor.fromData(currentData[mapKey] as Record<string, unknown>);
    
    return hydratedModel as T;
  }

  /**
   * Delete a specific entry from an embedMap field.
   * 
   * @param fieldKey - The name of the embedMap field
   * @param mapKey - The key within the map to delete
   * @returns true if the entry was deleted, false if it didn't exist
   */
  protected deleteFromMap<K extends keyof this & string>(
    fieldKey: K,
    mapKey: string
  ): boolean {
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const fieldMeta = schema.fields[fieldKey as string];

    if (!fieldMeta?.relation || fieldMeta.relation.structure !== 'map') {
      throw new BaseError(
        `'deleteFromMap' can only be used on an 'embedMap' field.`
      );
    }

    const currentData = (this.get(fieldKey as string) as Record<string, unknown>) || {};
    
    if (!(mapKey in currentData)) {
      return false;
    }

    const { [mapKey]: _removed, ...updatedData } = currentData;
    
    this.set(fieldKey, updatedData);
    
    return true;
  }

  /**
   * Check if a specific key exists in an embedMap field.
   * 
   * @param fieldKey - The name of the embedMap field
   * @param mapKey - The key within the map to check
   * @returns true if the key exists, false otherwise
   */
  protected hasInMap<K extends keyof this & string>(
    fieldKey: K,
    mapKey: string
  ): boolean {
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const fieldMeta = schema.fields[fieldKey as string];

    if (!fieldMeta?.relation || fieldMeta.relation.structure !== 'map') {
      throw new BaseError(
        `'hasInMap' can only be used on an 'embedMap' field.`
      );
    }

    const currentData = (this.get(fieldKey as string) as Record<string, unknown>) || {};
    
    return mapKey in currentData && currentData[mapKey] !== undefined;
  }

  /**
   * Get all entries from an embedMap field as an array of [key, hydratedModel] tuples.
   * 
   * @param fieldKey - The name of the embedMap field
   * @returns Array of [key, hydratedModel] tuples
   */
  protected async getMapEntries<K extends keyof this & string, T extends IBaseModel>(
    fieldKey: K
  ): Promise<Array<[string, T]>> {
    const constructor = this.constructor as IBaseModelConstructor;
    const schema = constructor.getProcessedSchema();
    const fieldMeta = schema.fields[fieldKey as string];

    if (!fieldMeta) {
      throw new BaseError(`Field '${fieldKey}' is not defined in the schema.`);
    }

    const isMap = fieldMeta.relation?.cardinality === 'many' && 
                  fieldMeta.relation?.structure === 'map';

    if (!isMap) {
      throw new BaseError(`'getMapEntries' can only be used on an 'embedMap' field.`);
    }

    const currentData = (this.get(fieldKey as string) as Record<string, ModelData<IBaseModel>>) || {};
    
    if (fieldMeta.relation?.type === 'reference') {
      throw new BaseError(`'getMapEntries' is not supported for reference relations.`);
    }

    const modelConstructor = resolve(fieldMeta.relation!.model);
    const entries: Array<[string, T]> = [];

    for (const [key, data] of Object.entries(currentData)) {
       
      const hydratedModel = await modelConstructor.fromData(data as Record<string, unknown>);
       
      entries.push([key, hydratedModel as T]);
    }

    return entries;
  }
}
