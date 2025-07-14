
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
} from "./types.js";

import { UniqueID } from "./uniqueId.js";

export type BaseModelClass = typeof BaseModel;

export abstract class BaseModel {
    // A unique, private key to store metadata on the class constructor.
    private static readonly modelSchemaKey = Symbol("modelSchema");

    @di("BasePubSub")
    accessor #pubSub!: BasePubSub;

    #data: Record<string, unknown> = {};
    #originalData: Record<string, unknown> = {};
    #dirty: boolean = false;
    #new: boolean = true;

    // public static getCollection<T extends BaseModel<T>>(
    // this: ModelConstructor<T>,
    // src: Iterable<ModelData<T>> | AsyncIterable<ModelData<T>>
    // ): ModelCollection<T> {
    //     // Drop-in concrete collection we wrote earlier
    //     return new SimpleModelCollection(src, this);
    // }


    constructor() {
        this.setDefaults();
        this.init();
    }

    protected init() {
        // Initialization logic if needed
    }
    
    // Collection method removed - will be implemented by specific model types that need it
    // Models should implement Queryable interface if they need collection functionality

    // Factory method removed from instance - will be static on specific model types

    // --- METADATA HANDLING LOGIC ---

    /**
     * A simple recursive clone function that correctly handles functions.
     * This is not a perfect deep clone, but it's what's needed here.
     */
    private static _cloneWithFunctions<T>(source: T): T {
        if (typeof source !== 'object' || source === null) {
            return source; // Primitives and functions are returned as-is
        }

        const clone = (Array.isArray(source) ? [] : {}) as T;

        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                (clone as Record<string, unknown>)[key] = this._cloneWithFunctions((source as Record<string, unknown>)[key]);
            }
        }
        
        return clone;
    }

    /**
     * Safely retrieves or initializes the schema object on a class constructor.
     * This is the core utility that prevents shared state between models.
     */
    private static getOrInitSchema(constructor: typeof BaseModel): BaseModelSchema {
        // Use `Object.hasOwnProperty.call` for safety.
        if (!Object.prototype.hasOwnProperty.call(constructor, this.modelSchemaKey)) {
            const parentConstructor = Object.getPrototypeOf(constructor) as Record<symbol, BaseModelSchema> | null;
            let newSchema: BaseModelSchema = { fields: {}, meta: {} };

            // If there's a parent with a schema, clone it.
            if (parentConstructor?.[this.modelSchemaKey]) {
                const parentSchema = parentConstructor[this.modelSchemaKey];
                // Use the CORRECT cloning function.
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
     * A static method for decorators to add a key-value pair to the model's metadata.
     */
    public static setMetaValue<K extends keyof ModelMetadata>(key: K, value: ModelMetadata[K]) {
        const schema = BaseModel.getOrInitSchema(this);
        schema.meta[key] = value;
    }

    /**
     * A static method for decorators to add field metadata.
     */
    public static addField(propertyName: string, meta: FieldMetadata) {
        const schema = BaseModel.getOrInitSchema(this);
        schema.fields[propertyName] = meta;
    }

    /**
     * Get the processed schema directly from the constructor.
     */
    public static getProcessedSchema(): BaseModelSchema {
        return BaseModel.getOrInitSchema(this);
    }

    /**
     * TEMPORARY: Backward compatibility method for tests.
     * TODO: Remove this once tests are updated to use decorators.
     */
    public static registerField<T>(
        fieldName: string,
        options: FieldOptions<T>,
    ) {
        const fieldMetadata: FieldMetadata = {
            options,
        };
        this.addField(fieldName, fieldMetadata);
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

    protected async hydrate(data: ModelData<this>): Promise<void> {
        const constructor = this.constructor as typeof BaseModel;
        const schema = constructor.getProcessedSchema();
        
        // Cast to allow for the generic iteration
        const dataRecord = data as Record<string, unknown>;
        
        // First, validate that all provided fields exist in the schema using getMeta
        for (const key in dataRecord) {
            this.getMeta(key); // This will throw if field is not in schema
        }
        
        // Then process the fields
        for (const key in schema.fields) {
            if (key in dataRecord) {
                let value = dataRecord[key];
                
                // Special handling for 'id' field: convert string to UniqueID
                if (key === 'id' && typeof value === 'string') {
                    value = new UniqueID(value);
                }
                
                this.#originalData[key] = value;
                this.#data[key] = value;
            }
        }
        this.#dirty = false;
        this.#new = false;
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
     */
    public static async fromData<T extends BaseModel>(
        this: new () => T, 
        data: ModelData<T>
    ): Promise<T> {
        const instance = new this();
        await instance.hydrate(data);
        return instance;
    }

    private getMeta(
        key: string,
    ): { constructor: typeof BaseModel; fieldOptions: FieldOptions } {
        const constructor = this.constructor as typeof BaseModel;
        const schema = constructor.getProcessedSchema();
        const fieldMeta = schema.fields[key];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!fieldMeta) {
            throw new BaseError(`Field "${key}" is not defined in the schema.`);
        }
        return { constructor, fieldOptions: fieldMeta.options };
    }

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

    public get<T>(key: string): T {
        const { fieldOptions } = this.getMeta(key);
        if (!(key in this.#data)) {
            return undefined as T;
        }
        return this.beforeGet(key, this.#data[key] as T, fieldOptions) as T;
    }

    public set<T>(key: string, value: T): void {
        const { fieldOptions } = this.getMeta(key);
        if (fieldOptions.readOnly) {
            throw new BaseError(`Field "${key}" is readonly and cannot be set.`);
        }
        if (!this.beforeSet(key, value, fieldOptions)) return;
        
        // Only mark as dirty if the value is actually different
        const currentValue = this.#data[key];
        if (currentValue !== value) {
            this.#dirty = true;
        }
        
        this.#data[key] = value;
    }

    public has(key: string): boolean {
        return this.defined(key) && key in this.#data &&
            this.#data[key] !== undefined;
    }

    public defined(key: string): boolean {
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

    public serialise(): ModelData<this> {
        const constructor = this.constructor as typeof BaseModel;
        const schema = constructor.getProcessedSchema();
        const data: Record<string, unknown> = {};
        for (const key in schema.fields) {
            if (this.has(key)) {
                data[key] = this.get(key);
            }
        }
        return data as ModelData<this>;
    }

    public async save(): Promise<void> {
        if (!this.dirty) return;

        if (this.isPersistable()) {
            await this.persist();
            const newItem = this.#new;
            this.#new = false;
            this.#dirty = false;
            this.#originalData = { ...this.#data };

            await this.publishDataEvent(newItem ? "create" : "update", this.serialise());

        } else {
            throw new BaseError(`Model '${this.constructor.name}' does not implement the Persistable interface.`);
        }
    }

    public async remove(): Promise<void> {

        if (this.isDeletable()) {
            const originalData = this.serialise();
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
        if (!this.#dirty) return;
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
