import { type BaseModel } from "./baseModel.js";
import { type ModelData, type ModelConstructor } from "./types.js";

/**
 * A concrete, minimal collection that implements lazy iteration.
 * Does NOT implement Countable or Slicable by default.
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
                const model = await this.modelConstructor.fromData(item) as T;
                yield model;
            }
        } else {
            // Handle Iterable - lazy loading  
            for (const item of this.source) {
                const model = await this.modelConstructor.fromData(item) as T;
                yield model;
            }
        }
    }

    /**
     * Get all items as an array. 
     * WARNING: This will load ALL data into memory. Use with extreme caution on large collections.
     */
    async toArray(): Promise<T[]> {
        const items: T[] = [];
        for await (const item of this) {
            items.push(item);
        }
        return items;
    }
}
