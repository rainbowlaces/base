import { type BaseModel } from "./baseModel.js";
import { type ModelData, type ModelConstructor, type NoDerivedModelData } from "./types.js";

/**
 * A concrete, minimal collection that implements lazy iteration.
 * Specific implementations should extend this and add capabilities as needed.
 * 
 * CRITICAL: This collection is LAZY - it only loads data when iterated.
 */
export class BaseModelCollection<T extends BaseModel> implements AsyncIterable<T> {
    protected readonly source: Iterable<ModelData<T>> | AsyncIterable<ModelData<T>>;
    protected readonly modelConstructor: ModelConstructor<T>;

    constructor(
        src: Iterable<ModelData<T>> | AsyncIterable<ModelData<T>>,
        constructor: ModelConstructor<T>
    ) {
        this.source = src;
        this.modelConstructor = constructor;
        this.init();
    }

    protected init(): void {
        // Initialization logic if needed
    }

    async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
        if (Symbol.asyncIterator in this.source) {
            // Handle AsyncIterable - lazy loading
            for await (const item of this.source) {
                const model = await this.modelConstructor.fromData(item);
                yield model;
            }
        } else {
            // Handle Iterable - lazy loading  
            for (const item of this.source) {
                const model = await this.modelConstructor.fromData(item);
                yield model;
            }
        }
    }

    /**
     * Convert collection to array of model instances.
     * WARNING: This will load ALL data into memory. Use with extreme caution on large collections.
     */
    async toArray(): Promise<T[]> {
        const items: T[] = [];
        if (Symbol.asyncIterator in this.source) {
            for await (const item of this.source) {
                const model = await this.modelConstructor.fromData(item);
                items.push(model);
            }
        } else {
            for (const item of this.source) {
                const model = await this.modelConstructor.fromData(item);
                items.push(model);
            }
        }
        return items;
    }

    /**
     * Serialize all items to raw data array.
     * WARNING: This will load ALL data into memory. Use with extreme caution on large collections.
     */
    async serialize(): Promise<NoDerivedModelData<T>[]> {
        const items: NoDerivedModelData<T>[] = [];
        if (Symbol.asyncIterator in this.source) {
            for await (const item of this.source) {
                const model = await this.modelConstructor.fromData(item);
                items.push(model.serialize());
            }
        } else {
            for (const item of this.source) {
                const model = await this.modelConstructor.fromData(item);
                items.push(model.serialize());
            }
        }
        return items;
    }
}
