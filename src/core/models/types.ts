import { type BaseModel } from './baseModel.js';
import { type BaseIdentifiableModel } from './baseIdentifiableModel.js';
import { type BaseModelCollection } from './baseModelCollection.js';
import { type UniqueID } from './uniqueId.js';
import { type Thunk } from '../../utils/thunk.js';
import { type MaybeAsync, type Scalar } from '../types.js';

export type Cardinality = 'one' | 'many';
export type RelationType = 'reference' | 'embed';

// --- ATTRIBUTABLE TYPES ---

/** A union of supported attribute type constructors. */
export type AttributeTypeConstructor = StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor | typeof UniqueID;

/**
 * Defines the specification for a model's attributes. Maps an attribute
 * name to a tuple containing its [TypeConstructor, Cardinality].
 */
export interface AttributeSpec {
    readonly [key: string]: readonly [type: AttributeTypeConstructor, cardinality: 'single' | 'many'];
}

/** Helper to get the instance type (e.g., string) from a constructor type (e.g., StringConstructor) */
export type AttributeValue<T extends AttributeSpec, K extends keyof T> = InstanceType<T[K][0]>;

/** Helper to determine the return type of getAttribute based on cardinality */
export type GetAttributeReturn<T extends AttributeSpec, K extends keyof T> =
    T[K][1] extends 'single' ? AttributeValue<T, K> | undefined : AttributeValue<T, K>[];

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

export type ModelsEventType = "create" | "update" | "delete";

export type ModelsEventData = object;
export interface ModelsEvent<E = ModelsEventData> {
    id: UniqueID;
    type: ModelsEventType;
    model: BaseModel;
    data: E;
}

export type ModelConstructor<T extends BaseModel = BaseModel> = (new () => T) & typeof BaseModel;

// Options for the @field decorator
export interface FieldOptions<T = unknown> {
    readOnly?: boolean;
    derived?: boolean;
    default?: (() => T);
    hydrator?: (value: unknown) => T;
    validator?: (value: T) => true;
    serializer?: (value: T) => Scalar | object | undefined;
}

export type AsyncDefinedId<T extends BaseIdentifiableModel> = MaybeAsync<DefinedId<T>>;
export type AsyncDefinedIds<T extends BaseIdentifiableModel> = MaybeAsync<DefinedId<T>[]>;
export type DefinedId<T extends BaseIdentifiableModel> = T | UniqueID | string;
export type DefinedIds<T extends BaseIdentifiableModel> = DefinedId<T>[];

// --- Capability Interfaces (as per refactoring spec) ---

export interface Persistable {
    persist(): Promise<void>;
}

export interface Deletable {
    delete(): Promise<void>;
}

// Collection Capabilities
export interface Slicable {
    slice(offset: number, limit: number): Promise<this>;
}

export interface Countable {
    count(): Promise<number | undefined>;
}

export type Derived<T> = Promise<T>;

// --- Relationship Types ---
export interface RefOne<T extends BaseIdentifiableModel> {
    (): Promise<T | undefined>;
    (value: AsyncDefinedId<T>): Promise<void>;
}

export interface RefMany<T extends BaseIdentifiableModel> {
    (): Promise<BaseModelCollection<T>>;
    (values: AsyncDefinedIds<T>): Promise<void>;
}

export interface EmbedOne<T extends BaseModel> {
    (): Promise<T | undefined>;
    (value: MaybeAsync<T>): Promise<void>;
}

export interface EmbedMany<T extends BaseModel> {
    (): Promise<BaseModelCollection<T>>;
    (values: MaybeAsync<T[] | BaseModelCollection<T>>): Promise<void>;
}

type DerivedFieldKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof T]: T[P] extends () => Derived<any> ? P : never;
}[keyof T];

export type NoDerivedModelData<T extends BaseModel> = Omit<ModelData<T>, DerivedFieldKeys<T>>;

// The definitive ModelData<T> type in src/core/models/types.ts
export type ModelData<T extends BaseModel> = {
    [P in keyof T]?:
        // 1. Handle Derived Fields
        T[P] extends () => Derived<infer U> ? U
        // 2. Handle Relationships (these break circular dependencies)
        : T[P] extends RefOne<infer U> ? DefinedId<U>
        : T[P] extends RefMany<infer U> ? DefinedId<U>[]
        // 3. Handle Embeds (these are intentionally recursive)
        : T[P] extends EmbedOne<infer U> ? ModelData<U>
        : T[P] extends EmbedMany<infer U> ? ModelData<U>[]
        // 4. THE GUARD: Handle all other methods
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        : T[P] extends Function ? never
        // 5. Handle all standard data properties
        : T[P];
};