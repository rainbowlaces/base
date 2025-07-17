import { type BaseModel } from './baseModel.js';
import { type BaseIdentifiableModel } from './baseIdentifiableModel.js';
import { type BaseModelCollection } from './baseModelCollection.js';
import { type UniqueID } from './uniqueId.js';
import { type Thunk } from '../../utils/thunk.js';
import { type MaybeAsync, type Scalar } from '../types.js';

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
    default?: (() => T);
    hydrator?: (value: unknown) => T;
    validator?: (value: T) => boolean;
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
    (value: T | Promise<T>): Promise<void>;
}

export interface EmbedMany<T extends BaseModel> {
    (): Promise<BaseModelCollection<T>>;
    (values: T[] | Promise<T[]>): Promise<void>;
}

export type ModelData<T extends BaseModel = BaseModel> = {
    [P in keyof T]?: T[P] extends RefOne<infer U> | RefMany<infer U>
        ? DefinedId<U> | DefinedId<U>[]
        : T[P] extends EmbedOne<infer U>
        ? ModelData<U>
        : T[P] extends EmbedMany<infer U>
        ? ModelData<U>[]
        : T[P];
};

// Backward compatibility aliases
export type ModelCollection<T extends BaseModel> = BaseModelCollection<T>;
export type IdentifiableModel<T extends BaseIdentifiableModel> = T;