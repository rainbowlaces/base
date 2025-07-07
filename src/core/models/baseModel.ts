import { type BasePubSub, di, string } from "../../index";

import {
    type ModelsEvent,
    type ModelsEventData,
    type FieldOptions,
    type ModelConstructor,
    type ModelData,
    type ModelsEventType,
    type Persistable,
    type Deletable,
} from "./types";

import { UniqueID } from "./uniqueId";

export type BaseModelClass<T extends BaseModel<T>> = typeof BaseModel & ModelConstructor<T>;

export abstract class BaseModel<T extends BaseModel<T>> {
    static #schema: Partial<Record<string, FieldOptions>> = {};

    @di("BasePubSub")
    accessor #pubSub!: BasePubSub;

    #data: Record<string, unknown> = {};
    #originalData: Record<string, unknown> = {};
    #dirty: boolean = false;
    #new: boolean = true;

    constructor() {
        const constructor = this.constructor as typeof BaseModel;
        for (const key in constructor.#schema) {
            const options = constructor.#schema[key];
            if (!options) throw new Error(`Field "${key}" is not defined in the schema.`);
            if (options.default) {
                const val = typeof options.default === "function"
                    ? (options.default as () => unknown)()
                    : options.default;
                this.#data[key] = val;
                this.#originalData[key] = val;
            }
        }
    }

    private get dirty(): boolean {
        if (this.#new) return true;
        return this.#dirty;
    }

    protected async hydrate(data: ModelData<T>) {
        const constructor = this.constructor as typeof BaseModel;
        for (const key in constructor.#schema) {
            if (key in data) {
                this.#originalData[key] = data[key];
                this.#data[key] = data[key];
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
    }

    public static registerField<T>(
        fieldName: string,
        options: FieldOptions<T>,
    ) {
        this.#schema[fieldName] = options;
    }

    /**
     * Static factory method to create a model instance pre-populated with data.
     * This provides a clean public interface instead of casting to Hydratable.
     */
    public static async fromData<T extends BaseModel<T>>(
        this: ModelConstructor<T>, 
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
        const fieldOptions = constructor.#schema[key];
        if (!fieldOptions) {
            throw new Error(`Field "${key}" is not defined in the schema.`);
        }
        return { constructor, fieldOptions };
    }

    public unset(key: string): boolean {
        const { fieldOptions } = this.getMeta(key);
        if (!(key in this.#data)) {
            throw new Error(`Field "${key}" is not set.`);
        }
        if (!this.beforeUnset(key, fieldOptions)) return false;
        this.#dirty = true;
        this.#data[key] = undefined;
        return true;
    }

    public get<T>(key: string): T {
        const { fieldOptions } = this.getMeta(key);
        if (!(key in this.#data)) {
            throw new Error(`Field "${key}" is not set.`);
        }
        return this.beforeGet(key, this.#data[key] as T, fieldOptions) as T;
    }

    public set<T>(key: string, value: T): void {
        const { fieldOptions } = this.getMeta(key);
        if (fieldOptions.readOnly) {
            throw new Error(`Field "${key}" is readonly and cannot be set.`);
        }
        if (!this.beforeSet(key, value, fieldOptions)) return;
        this.#dirty = true;
        this.#data[key] = value;
    }

    public has(key: string): boolean {
        return this.defined(key) && key in this.#data &&
            this.#data[key] !== undefined;
    }

    public defined(key: string): boolean {
        try {
            const { constructor } = this.getMeta(key);
            return key in constructor.#schema;
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

    public serialise(): ModelData<T> {
        const constructor = this.constructor as typeof BaseModel;
        const data: Record<string, unknown> = {};
        for (const key in constructor.#schema) {
            if (this.has(key)) {
                data[key] = this.get(key);
            }
        }
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

            await this.publishDataEvent(newItem ? "create" : "update", this.serialise());

        } else {
            throw new Error(`Model '${this.constructor.name}' does not implement the Persistable interface.`);
        }
    }

    public async remove(): Promise<void> {

        if (this.isDeletable()) {
            const originalData = this.serialise();
            await this.delete();
            this.#new = true;
            this.#dirty = false;
            this.#originalData = {};
            await this.publishDataEvent("delete", originalData);
        } else {
            throw new Error(`Model '${this.constructor.name}' does not implement the Deletable interface.`);
        }
    }

    public revert(): void {
        if (!this.#dirty) return;
        this.#data = { ...this.#originalData };
        this.#dirty = false;
    }

    // events

    private getTopicName() {
        return string.camelToKebab(this.constructor.name);
    }
 
    protected getEventTopic(event: ModelsEventType): string {
        return `/models/${event}/${this.getTopicName()}`;
    }

    private async publishDataEvent<E extends ModelsEventData>(
        type: ModelsEventType,
        data: E,
    ): Promise<void> {
        const event: ModelsEvent<T, E> = {
            id: new UniqueID(),
            type,
            model: this,
            data,
        };
        await this.#pubSub.pub(this.getEventTopic(type), { event });
    }


}
