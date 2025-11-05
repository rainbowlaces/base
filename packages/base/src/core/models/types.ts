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

// --- ATTRIBUTABLE TYPES ---

/** A union of supported attribute type constructors for scalar values. */
export type AttributeScalarConstructor = StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor | typeof UniqueID;

/** Legacy alias for backward compatibility */
export type AttributeTypeConstructor = AttributeScalarConstructor;

/**
 * Runtime validator interface for complex objects.
 * Provides type-safe validation through TypeScript type guards.
 */
export interface ComplexAttributeType<T> {
    validate: (value: unknown) => value is T;
    
    /**
     * An optional function to define custom equality logic. It compares an
     * arbitrary value 'a' (e.g., an ID provided by the developer) against a
     * fully-formed instance 'b' from the attribute store.
     */
    equals?: (a: unknown, b: T) => boolean;
}

/**
 * Union type representing all valid attribute type definitions:
 * - Scalar constructors for primitive types
 * - Complex type validators for object types
 */
export type AttributeTypeDefinition = 
    | AttributeScalarConstructor 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | ComplexAttributeType<any>;

/**
 * Defines the specification for a model's attributes. Maps an attribute
 * name to a tuple containing its [TypeDefinition, Cardinality].
 */
export interface AttributeSpec {
    readonly [key: string]: readonly [type: AttributeTypeDefinition, cardinality: 'single' | 'many'];
}

/** Helper to get the instance type from a type definition */
export type AttributeValue<T extends AttributeSpec, K extends keyof T> = 
    T[K][0] extends StringConstructor ? string :
    T[K][0] extends NumberConstructor ? number :
    T[K][0] extends BooleanConstructor ? boolean :
    T[K][0] extends DateConstructor ? Date :
    T[K][0] extends typeof UniqueID ? UniqueID :
    T[K][0] extends ComplexAttributeType<infer U> ? U :
    never;

/** Helper to determine the return type of getAttribute based on cardinality */
export type GetAttributeReturn<T extends AttributeSpec, K extends keyof T> =
    T[K][1] extends 'single' ? AttributeValue<T, K> | undefined : AttributeValue<T, K>[];

/** Helper type to extract the Attributes property type from an attributable instance */
export type ExtractAttributeSpec<T> = T extends { readonly Attributes: infer A } ? A : AttributeSpec;

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
    data: NoDerivedModelData<E>;
}

export type ModelConstructor<T extends IBaseModel = IBaseModel> = (new () => T) & IBaseModelConstructor;

// Options for the @field decorator
export interface FieldOptions<T = unknown> {
    readOnly?: boolean;
    derived?: boolean;
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

export type Derived<T> = T;

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

type DerivedFieldKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof T]: T[P] extends () => Derived<any> ? P : never;
}[keyof T];

export type NoDerivedModelData<T extends IBaseModel> = Omit<ModelData<T>, DerivedFieldKeys<T>>;

type Awaited<T> = T extends PromiseLike<infer U> ? U : T;

export type ModelData<T extends IBaseModel> = {
    [P in keyof T]?:
        T[P] extends () => Derived<infer U> ? Awaited<U>
        : T[P] extends RefOne<infer U> ? DefinedId<U>
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