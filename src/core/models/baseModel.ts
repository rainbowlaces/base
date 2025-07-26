
import { camelToKebab } from "../../utils/string.js";
import { di } from "../di/baseDi.js";
import { type BasePubSub } from "../pubsub/basePubSub.js";
import { BaseError } from "../baseErrors.js";
import {
    type ModelsEventData,
    type FieldOptions,
    type ModelData,
    type ModelsEventType,
    type Persistable,
    type Deletable,
    type BaseModelSchema,
    type ModelMetadata,
    type FieldMetadata,
    type NoDerivedModelData,
    type ModelFieldKeys,
    type ModelFieldValue,
    type ModelRelationKeys,
} from "./types.js";

import { UniqueID } from "./uniqueId.js";

// Interface to avoid circular import with BaseIdentifiableModel
interface HasId {
    id: UniqueID;
}

export type BaseModelClass = typeof BaseModel;

export abstract class BaseModel {
    private static readonly modelSchemaKey = Symbol("modelSchema");

    @di("BasePubSub")
    accessor #pubSub!: BasePubSub;

    #data: Record<string, unknown> = {};
    #originalData: Record<string, unknown> = {};
    #dirty: boolean = false;
    #new: boolean = true;


    constructor() {
        this.setDefaults();
        this.init();
    }

    protected init() {
        // Initialization logic if needed
    }

    // --- METADATA HANDLING LOGIC ---

    private static _cloneWithFunctions<T>(source: T): T {
        if (typeof source !== 'object' || source === null) {
            return source;
        }

        const clone = (Array.isArray(source) ? [] : {}) as T;

        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                (clone as Record<string, unknown>)[key] = this._cloneWithFunctions((source as Record<string, unknown>)[key]);
            }
        }
        
        return clone;
    }

    private static getOrInitSchema(constructor: typeof BaseModel): BaseModelSchema {
        if (!Object.prototype.hasOwnProperty.call(constructor, this.modelSchemaKey)) {
            const parentConstructor = Object.getPrototypeOf(constructor) as Record<symbol, BaseModelSchema> | null;
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
        return (constructor as unknown as Record<symbol, BaseModelSchema>)[this.modelSchemaKey];
    }

    /**
     * A private method for decorators to add a key-value pair to the model's metadata.
     * Decorators should access this via (target as any).setMetaValue()
     */
    private static setMetaValue<K extends keyof ModelMetadata>(key: K, value: ModelMetadata[K]) {
        const schema = BaseModel.getOrInitSchema(this);
        schema.meta[key] = value;
    }

    /**
     * A private method for decorators to add field metadata.
     * Decorators should access this via (target as any).addField()
     */
    private static addField(propertyName: string, meta: FieldMetadata) {
        const schema = BaseModel.getOrInitSchema(this);
        schema.fields[propertyName] = meta;
    }

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

    private setDefaults() {
        const constructor = this.constructor as typeof BaseModel;
        const schema = constructor.getProcessedSchema();
        
        for (const key in schema.fields) {
            const fieldMeta = schema.fields[key];
            if (fieldMeta.options.default) {
                const val = typeof fieldMeta.options.default === "function"
                    ? (fieldMeta.options.default as () => unknown)()
                    : fieldMeta.options.default;
                this.#data[key] = val;
                this.#originalData[key] = val;
            }
        }
    }

    private get dirty(): boolean {
        if (this.#new) return true;
        return this.#dirty;
    }

    public markAsDirty(): void {
        this.#dirty = true;
    }

    protected async hydrate(data: NoDerivedModelData<this>, isNew: boolean = false): Promise<void> {
        const constructor = this.constructor as typeof BaseModel;
        const schema = constructor.getProcessedSchema();
        
        const dataRecord = data as Record<string, unknown>;
        
        for (const key in dataRecord) {
            this.getMeta(key);
        }
        
        // Then process the fields
        for (const key in schema.fields) {
            if (key in dataRecord) {
                const rawValue = dataRecord[key];
                const fieldMeta = schema.fields[key];
                
                // Apply hydrator if available
                let value = rawValue;
                if (fieldMeta.options.hydrator) {
                    value = fieldMeta.options.hydrator(rawValue);
                }
                
                // Apply validator if available
                if (fieldMeta.options.validator) {
                    try {
                        fieldMeta.options.validator(value);
                    }                    
                    catch (error: Error | unknown) {
                        throw new BaseError(`Validation failed for field "${key}" during hydration`, error as Error);
                    }
                }
                
                this.#originalData[key] = value;
                this.#data[key] = value;
            }
        }
        this.#dirty = false;
        this.#new = isNew;
    }

    public reset() {
        this.#new = true;
        this.#dirty = false;
        this.#data = {};
        this.#originalData = {};
        this.setDefaults();
    }

    /**
     * Static factory method to create a model instance pre-populated with data.
     * This provides a clean public interface for model instantiation.
     * Use this for hydrating existing data (e.g., from database).
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
     */
    public static async create<T extends BaseModel>(
        this: new () => T,
        data: ModelData<T> = {} as ModelData<T>
    ): Promise<T> {
        const instance = new this();
        await instance.hydrate(data, true); // Pass true to mark as new
        return instance;
    }

    private getMeta(
        key: string,
    ): { constructor: typeof BaseModel; fieldOptions: FieldOptions } {
        const constructor = this.constructor as typeof BaseModel;
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
        return value === null || 
               value === undefined || 
               type === 'string' || 
               type === 'number' || 
               type === 'boolean' || 
               value instanceof Date;
    }

    /**
     * Compares two values to determine if they are effectively equal.
     * For scalar values, uses strict equality. For complex types, always returns false (assumes dirty).
     */
    private valuesEqual(oldValue: unknown, newValue: unknown): boolean {
        // If both are scalar types, compare with strict equality
        if (this.isScalarValue(oldValue) && this.isScalarValue(newValue)) {
            return oldValue === newValue;
        }
        
        // For complex types, always assume they're different (dirty)
        return false;
    }

    public unset(key: ModelFieldKeys<this>): boolean {
        const { fieldOptions } = this.getMeta(key);
        if (!(key in this.#data)) {
            throw new BaseError(`Field "${key}" is not set.`);
        }
        if (!this.beforeUnset(key, fieldOptions)) return false;
        this.#dirty = true;
        this.#data[key] = undefined;
        return true;
    }

    public get<K extends string>(key: K): K extends ModelFieldKeys<this> ? ModelFieldValue<this, K> : unknown {
        const { fieldOptions } = this.getMeta(key);
        if (!(key in this.#data)) {
            return undefined as K extends ModelFieldKeys<this> ? ModelFieldValue<this, K> : unknown;
        }
        return this.beforeGet(key, this.#data[key], fieldOptions) as K extends ModelFieldKeys<this> ? ModelFieldValue<this, K> : unknown;
    }

    // Internal method for decorator use - bypasses type checking
    protected _internalGet<T>(key: string): T {
        const { fieldOptions } = this.getMeta(key);
        if (!(key in this.#data)) {
            return undefined as T;
        }
        return this.beforeGet(key, this.#data[key], fieldOptions) as T;
    }

    // Internal method for decorator use - bypasses type checking
    protected _internalSet<T>(key: string, value: T): void {
        const { fieldOptions } = this.getMeta(key);
        if (fieldOptions.readOnly) {
            throw new BaseError(`Field "${key}" is readonly and cannot be set.`);
        }
        
        // Apply hydrator if available
        let convertedValue = value;
        if (fieldOptions.hydrator) {
            convertedValue = fieldOptions.hydrator(value) as T;
        }
        
        // Apply validator if available
        if (fieldOptions.validator) {
            try {
                fieldOptions.validator(convertedValue);
            } catch (_error) {
                throw new BaseError(`Validation failed for field "${key}"`);
            }
        }
        
        if (!this.beforeSet(key, convertedValue, fieldOptions)) return;
        
        // Smart dirty checking: only mark dirty if value actually changed
        const currentValue = this.#data[key];
        
        // If no current value exists, or values are not equal, mark dirty
        if (!(key in this.#data) || !this.valuesEqual(currentValue, convertedValue)) {
            this.#dirty = true;
        }
        
        this.#data[key] = convertedValue;
    }

    public set<K extends ModelFieldKeys<this>>(key: K, value: ModelFieldValue<this, K>): void {
        const { fieldOptions } = this.getMeta(key);
        if (fieldOptions.readOnly) {
            throw new BaseError(`Field "${key}" is readonly and cannot be set.`);
        }
        
        // Apply hydrator if available
        let convertedValue = value;
        if (fieldOptions.hydrator) {
            convertedValue = fieldOptions.hydrator(value) as ModelFieldValue<this, K>;
        }
        
        // Apply validator if available
        if (fieldOptions.validator) {
            try {
                fieldOptions.validator(convertedValue);
            } catch (_error) {
                throw new BaseError(`Validation failed for field "${key}"`);
            }
        }
        
        if (!this.beforeSet(key, convertedValue, fieldOptions)) return;
        
        // Smart dirty checking: only mark dirty if value actually changed
        const currentValue = this.#data[key];
        
        // If no current value exists, or values are not equal, mark dirty
        if (!(key in this.#data) || !this.valuesEqual(currentValue, convertedValue)) {
            this.#dirty = true;
        }
        
        this.#data[key] = convertedValue;
    }

    protected appendTo<T extends BaseModel>(
        relationName: ModelRelationKeys<this>,
        itemsToAdd: T | T[]
    ): void {
        const constructor = this.constructor as typeof BaseModel;
        const schema = constructor.getProcessedSchema();
        const fieldMeta = schema.fields[relationName as string];

        if (!fieldMeta?.relation || fieldMeta.relation.cardinality !== 'many') {
            throw new BaseError(`'appendTo' can only be used on a 'many' relationship field.`);
        }

        const currentRawData = this.get(relationName) as unknown[] || [];

        const items = Array.isArray(itemsToAdd) ? itemsToAdd : [itemsToAdd];
        let newRawItems: unknown[];

        if (fieldMeta.relation.type === 'reference') {
            newRawItems = items.map(item => {
                // Check if item has an id field (duck typing to avoid circular import)
                if (!('id' in item)) {
                    throw new BaseError('Cannot append a non-identifiable model to a reference relation.');
                }
                const hasId = item as unknown as HasId;
                return hasId.id;
            });
        } else {
            newRawItems = items.map(item => item.serialize());
        }

        const newRawData = [...currentRawData, ...newRawItems];
        this.set(relationName, newRawData as ModelFieldValue<this, typeof relationName>);
    }

    public has(key: ModelFieldKeys<this>): boolean {
        return this.defined(key) && key in this.#data &&
            this.#data[key] !== undefined;
    }

    public defined(key: ModelFieldKeys<this>): boolean {
        try {
            const constructor = this.constructor as typeof BaseModel;
            const schema = constructor.getProcessedSchema();
            return key in schema.fields;
        } catch {
            return false;
        }
    }

    protected beforeUnset(
        _key: string,
        _schema: FieldOptions,
    ): boolean {
        return true;
    }

    protected beforeSet<T>(
        _key: string,
        _value: T,
        _schema: FieldOptions,
    ): boolean {
        return true;
    }

    protected beforeGet<T>(
        _key: string,
        _value: T,
        _schema: FieldOptions,
    ): T | undefined {
        return _value;
    }

    protected isPersistable(): this is this & Persistable {
        return typeof (this as unknown as Persistable).persist === 'function';
    }

    protected isDeletable(): this is this & Deletable {
        return typeof (this as unknown as Deletable).delete === 'function';
    }

    protected beforeHas(_key: string, _schema: FieldOptions): boolean {
        return true;
    }

    private serializeField(
        key: string,
        value: unknown,
        schema: BaseModelSchema,
    ): unknown {
        const serializer = schema.fields[key].options.serializer;
        return serializer ? serializer(value) : value;
    }

    public serialize<T extends BaseModel>(this: T): NoDerivedModelData<T> {
        const constructor = this.constructor as typeof BaseModel;
        const schema = constructor.getProcessedSchema();
        const data: Record<string, unknown> = {};        
        for (const key in schema.fields) {
            const typedKey = key as ModelFieldKeys<T>;
            if (this.has(typedKey)) {
                const value = this.serializeField(key, this.get(typedKey), schema);
                if (value === undefined) continue;
                data[key] = value;
            }
        }
        
        return data as ModelData<T>;
    }

   public async derive<T extends this>(): Promise<ModelData<T>> {
        const constructor = this.constructor as typeof BaseModel;
        const schema = constructor.getProcessedSchema();
        const data: Record<string, unknown> = this.serialize();
        const promises: Promise<void>[] = [];

        for (const key in schema.fields) {
            if (schema.fields[key].options.derived) {
                promises.push((async () => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const method = (this as any)[key];
                    if (typeof method === 'function') {
                        data[key] = await method.call(this);
                    }
                })());
            }
        }

        await Promise.all(promises);
        return data as ModelData<T>;
    }


    public async save(): Promise<void> {        
        if (!this.dirty) return;

        if (this.isPersistable()) {            
            await this.persist();
            const newItem = this.#new;
            this.#new = false;
            this.#dirty = false;
            this.#originalData = { ...this.#data };

            await this.publishDataEvent(newItem ? "create" : "update", this.serialize());

        } else {
            throw new BaseError(`Model '${this.constructor.name}' does not implement the Persistable interface.`);
        }
    }

    public async remove(): Promise<void> {

        if (this.isDeletable()) {
            const originalData = this.serialize();
            await this.delete();
            this.#new = true;
            this.#dirty = false;
            this.#data = {};
            this.#originalData = {};
            await this.publishDataEvent("delete", originalData);
        } else {
            throw new BaseError(`Model '${this.constructor.name}' does not implement the Deletable interface.`);
        }
    }

    public revert(): void {
        if (!this.dirty) return;
        this.#data = { ...this.#originalData };
        this.#dirty = false;
    }

    // events

    private getTopicName() {
        return camelToKebab(this.constructor.name);
    }
 
    protected getEventTopic(event: ModelsEventType): string {
        return `/models/${event}/${this.getTopicName()}`;
    }

    private async publishDataEvent<E extends ModelsEventData>(
        type: ModelsEventType,
        data: E,
    ): Promise<void> {
        const event = {
            id: new UniqueID(),
            type,
            model: this,
            data,
        };
        await this.#pubSub.pub(this.getEventTopic(type), { event });
    }

}
