// src/core/models/baseModelCollection.ts
import { type ModelData, type ModelConstructor, type NoDerivedModelData, type IBaseModel } from "./types.js";

/**
 * A concrete, minimal collection that implements lazy iteration.
 */
export class BaseModelCollection<T extends IBaseModel> implements AsyncIterable<T> {
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
                yield await this.modelConstructor.fromData(item) as T;
            }
        } else {
            // Handle Iterable - lazy loading  
            for (const item of this.source) {
                yield await this.modelConstructor.fromData(item) as T;
            }
        }
    }

    async toArray(): Promise<T[]> {
        const items: T[] = [];
        for await (const model of this) {
            items.push(model);
        }
        return items;
    }

    async serialize(): Promise<NoDerivedModelData<T>[]> {
        const models = await this.toArray();
        return models.map(model => model.serialize() as NoDerivedModelData<T>);
    }
}