import { type BaseModel } from "./baseModel";
import { type IdentifiableModel } from "./identifyableModel";
import { type ModelCollection } from "./modelCollection";
import { type UniqueID } from "./uniqueId";

export type Cardinality = 'one' | 'many';

export type ModelsEventType = "create" | "update" | "delete";

export type ModelsEventData = object;
export interface ModelsEvent<T extends BaseModel<T>, E = ModelsEventData> {
    id: UniqueID;
    type: ModelsEventType;
    model: BaseModel<T>;
    data: E;
}

export type ModelConstructor<T extends BaseModel<T>> = (new () => T) & {
    fromData(data: ModelData<T>): Promise<T>;
};

// Options for the @field decorator
export interface FieldOptions<T = unknown> {
    readOnly?: boolean;
    default?: (() => T);
}

export type AsyncDefinedId<T extends IdentifiableModel<T>> = DefinedId<T> | Promise<DefinedId<T>>;
export type AsyncDefinedIds<T extends IdentifiableModel<T>> = DefinedIds<T> | Promise<DefinedIds<T>>;
export type DefinedId<T extends IdentifiableModel<T>> = T | UniqueID | string;
export type DefinedIds<T extends IdentifiableModel<T>> = DefinedId<T>[];

// Model Capabilities
export interface Persistable {
    persist(): Promise<void>;
}

export interface Deletable {
    delete(): Promise<void>;
}

export interface Hydratable<T extends BaseModel<T>> {
    hydrate(data: ModelData<T>): Promise<void>;
}

export interface FindableById<T extends IdentifiableModel<T>, I> {
    byId(id: I): Promise<T | undefined>;
}

export interface FindableByIds<T extends IdentifiableModel<T>, I> {
    byIds(ids: I[]): Promise<ModelCollection<T>>;
}

export interface Queryable<T extends BaseModel<T>, Q> {
    query(query: Q): Promise<ModelCollection<T>>;
} 

// Collection Capabilities
export interface Sliceable {
    slice(offset: number, limit: number): Promise<this>;
}

export interface Countable {
    count(): Promise<number | undefined>;
}

// --- Relationship Types ---
export interface RefOne<T extends IdentifiableModel<T>> {
    (): Promise<T | undefined>;
    (value: AsyncDefinedId<T>): Promise<void>;
}

export interface RefMany<T extends IdentifiableModel<T>> {
    (): Promise<T[]>;
    (values: AsyncDefinedIds<T>): Promise<void>;
}

export interface EmbedOne<T extends BaseModel<T>> {
    (): Promise<T | undefined>;
    (value: T | Promise<T>): Promise<void>;
}

export interface EmbedMany<T extends BaseModel<T>> {
    (): Promise<T[]>;
    (values: T[] | Promise<T[]>): Promise<void>;
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReferenceOrEmbed = RefOne<any> | RefMany<any> | EmbedOne<any> | EmbedMany<any>;

export type ModelData<T extends BaseModel<T>> =

    Record<string, unknown> &

    // Start with the conditional 'id' for identifiable models.
    (T extends { id: UniqueID } ? { id: UniqueID } : object)

    // Intersect with the serialized relationship properties.
    & {
        // First, map over the keys of T, keeping only the keys whose
        // properties are one of our callable relationships.
        [P in keyof T as T[P] extends ReferenceOrEmbed ? P : never]:

            // Now, transform the type of each relationship property.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            T[P] extends RefOne<any> ? UniqueID | undefined :
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            T[P] extends RefMany<any> ? UniqueID[] | undefined :
            T[P] extends EmbedOne<infer U> ? ModelData<U> | undefined :
            T[P] extends EmbedMany<infer U> ? ModelData<U>[] | undefined :
            never;
    }

    // Finally, intersect with the primitive fields.
    & {
        // Map over the keys of T again, but this time *exclude* the keys
        // whose properties are one of our callable relationships.
        [P in keyof T as T[P] extends ReferenceOrEmbed ? never : P]: T[P];
    };