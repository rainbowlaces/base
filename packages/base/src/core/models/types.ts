import { type BaseIdentifiableModel } from './baseIdentifiableModel.js';
import { type BaseModelCollection } from './baseModelCollection.js';
import { type UniqueID } from './uniqueId.js';
import { type Thunk } from '../../utils/thunk.js';
import { type MaybeAsync, type Scalar } from '../types.js';
import { type Identifiable, type DefinedId, type AsyncDefinedId, type AsyncDefinedIds } from './utils.js';

/**
 * Minimal interface for BaseModel to break circular dependencies.
 * Intermediate layers (BaseModelCore, BaseModelRelations) reference this interface
 * instead of the concrete BaseModel class to avoid circular type dependencies.
 * The concrete BaseModel class implements this interface with proper generic constraints.
 */
export interface IBaseModel {
  // Instance members needed by intermediate layers
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  serialize(): Record<string, unknown>;
}

/**
 * Type that exposes protected internal methods for decorator use.
 * Decorators can cast models to this type to access _internalGet/_internalSet.
 */
export interface IBaseModelDecoratorAccessor {
  _internalGet<T>(key: string): T;
  _internalSet(key: string, value: unknown): void;
}

/**
 * Constructor type for IBaseModel.
 * Used in intermediate layers when accessing `this.constructor`.
 */
export interface IBaseModelConstructor {
  new(): IBaseModel;
  getProcessedSchema(): BaseModelSchema;
  fromData(data: Record<string, unknown>): Promise<IBaseModel>;
}

export type Cardinality = 'one' | 'many';
export type RelationType = 'reference' | 'embed';

// --- METADATA INTERFACES (Designed for Extension) ---

/**
 * A container for arbitrary, model-level metadata.
 * Downstream modules (e.g., for persistence or search) will
 * add their own optional properties to this interface.
 *
 * @example
 * declare module './types' {
 *   interface ModelMetadata {
 *     mongo?: { collection: string };
 *   }
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ModelMetadata {
    // Intentionally empty.
}

/**
 * A container for arbitrary, field-level metadata.
 *
 * @example
 * declare module './types' {
 *   interface FieldMetadata {
 *     mongo?: { isIndexed?: boolean };
 *   }
 * }
 */
export interface FieldMetadata {
    /** The raw options passed to the field decorator. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: FieldOptions<any>;
    
    // Optional relation info.
    relation?: {
        type: RelationType;
        model: ModelConstructor | Thunk<ModelConstructor>;
        cardinality: Cardinality;
        structure?: 'array' | 'map';
    };
}

// --- THE UNIFIED SCHEMA OBJECT ---

/**
 * The canonical schema object for a given model, stored in the
 * BaseModel's central registry. It holds the complete description
 * of a model's structure and metadata.
 */
export interface BaseModelSchema {
    fields: Record<string, FieldMetadata>;
    meta: ModelMetadata;
}

export type ModelEventType = "create" | "update" | "delete";
export interface ModelEvent<E extends IBaseModel = IBaseModel> {
    id: UniqueID;
    type: ModelEventType;
    model: IBaseModel;
    data: ModelData<E>;
}

export type ModelConstructor<T extends IBaseModel = IBaseModel> = (new () => T) & IBaseModelConstructor;

// Options for the @field decorator
export interface FieldOptions<T = unknown> {
    readOnly?: boolean;
    default?: (() => T);
    hydrator?: (value: unknown) => T;
    validator?: (value: T) => true;
    serializer?: (value: T) => Scalar | object | undefined;
}

// Import the utility types from utils.ts to avoid circular dependency
export type { 
    Identifiable, 
    DefinedId, 
    AsyncDefinedId, 
    AsyncDefinedIds 
} from './utils.js';

// Keep this one for backward compatibility since it wasn't moved
export type DefinedIds<T extends Identifiable> = DefinedId<T>[];

// --- Capability Interfaces (as per refactoring spec) ---

export interface Persistable {
    _onPersist(): Promise<void>;
}

export interface Deletable {
    _onDelete(): Promise<void>;
}

// Collection Capabilities
export interface Slicable {
    slice(offset: number, limit: number): Promise<this>;
}

export interface Countable {
    count(): Promise<number | undefined>;
}

// --- Relationship Types ---
export interface RefOne<T extends BaseIdentifiableModel> {
    (): Promise<T | undefined>;
    (value: AsyncDefinedId<T>): Promise<void>;
}

export interface RefMany<T extends BaseIdentifiableModel> {
    (): Promise<BaseModelCollection<T>>;
    (values: AsyncDefinedIds<T>): Promise<void>;
}

export interface EmbedOne<T extends IBaseModel> {
    (): Promise<T | undefined>;
    (value: MaybeAsync<T>): Promise<void>;
}

export interface EmbedMany<T extends IBaseModel> {
    (): Promise<BaseModelCollection<T>>;
    (values: MaybeAsync<T[] | BaseModelCollection<T>>): Promise<void>;
}

export interface EmbedMap<T extends IBaseModel> {
    (): Promise<Map<string, T>>;
    (value: MaybeAsync<Map<string, T>>): Promise<void>;
}

export type ModelData<T extends IBaseModel> = {
    [P in keyof T]?:
        T[P] extends RefOne<infer U> ? DefinedId<U>
        : T[P] extends RefMany<infer U> ? DefinedId<U>[]
        : T[P] extends EmbedOne<infer U> ? ModelData<U>
        : T[P] extends EmbedMany<infer U> ? ModelData<U>[]
        : T[P] extends EmbedMap<infer U> ? Record<string, ModelData<U>>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        : T[P] extends Function ? never
        : T[P];
};

// --- TYPE-SAFE KEY UTILITIES ---

/** Extract valid field keys from a model instance - only data fields, not methods */
export type ModelFieldKeys<T extends IBaseModel> = string & keyof ModelData<T>;

/** Extract the type of a specific field from a model */
export type ModelFieldValue<T extends IBaseModel, K extends ModelFieldKeys<T>> = 
    K extends keyof ModelData<T> ? ModelData<T>[K] : unknown;

/** Extract only relation field keys that support 'many' cardinality for appendTo */
export type ModelRelationKeys<T extends IBaseModel> = {
    [P in keyof T]: T[P] extends RefMany<infer _U> 
        ? P extends string ? P : never
        : T[P] extends EmbedMany<infer _U>
        ? P extends string ? P : never
        : never;
}[keyof T];

/** Extract the item type for a many-relation field */
export type ModelRelationItemType<T extends IBaseModel, K extends ModelRelationKeys<T>> = 
    K extends keyof T 
        ? T[K] extends RefMany<infer U> ? U
        : T[K] extends EmbedMany<infer U> ? U
        : never
        : never;

/** Extract only map field keys that support embedMap operations */
export type ModelMapKeys<T extends IBaseModel> = {
    [P in keyof T]: T[P] extends EmbedMap<infer _U>
        ? P extends string ? P : never
        : never;
}[keyof T];

/** Extract the model type for a map field */
export type ModelMapItemType<T extends IBaseModel, K extends ModelMapKeys<T>> = 
    K extends keyof T 
        ? T[K] extends EmbedMap<infer U> ? U
        : never
        : never;