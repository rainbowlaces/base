import { BaseIdentifiableModel, type BaseModel, type Deletable, type ModelConstructor, type ModelData, type Persistable, type UniqueID } from '../../../src/index.js';
import { MemoryModelCollection } from './memoryModelCollection.js';

// A simple, global in-memory store.
const MEMORY_STORE = new Map<string, Map<string, ModelData<BaseModel>>>();

export abstract class MemoryModel extends BaseIdentifiableModel implements Persistable, Deletable {

    // Helper to get the specific store for this model type.
    private getClassStore(): Map<string, ModelData<BaseModel>> {
        const className = this.constructor.name;
        if (!MEMORY_STORE.has(className)) {
            MEMORY_STORE.set(className, new Map());
        }
        return MEMORY_STORE.get(className)!;
    }

    // Helper to get store for a specific class (static version)
    private static getClassStore(className: string): Map<string, ModelData<BaseModel>> {
        if (!MEMORY_STORE.has(className)) {
            MEMORY_STORE.set(className, new Map());
        }
        return MEMORY_STORE.get(className)!;
    }

    // --- Implementation of Persistable and Deletable ---
    public async persist(): Promise<void> {
        const store = this.getClassStore();
        const id = this.id.toString();
        const data = this.serialize();

        store.set(id, data);
    }


    public async delete(): Promise<void> {
        const store = this.getClassStore();
        store.delete(this.id.toString());
    }

    // --- Static query methods (override BaseIdentifiableModel) ---
    public static async byId<T extends BaseIdentifiableModel>(
        this: ModelConstructor<T>,
        id: UniqueID | string
    ): Promise<T | undefined> {
        const store = MemoryModel.getClassStore(this.name);
        const idString = typeof id === 'string' ? id : id.toString();
        const data = store.get(idString);
        
        if (!data) {
            return undefined;
        }

        return await this.fromData(data) as T;
    }

    public static async byIds<T extends BaseIdentifiableModel>(
        this: ModelConstructor<T>,
        ids: (UniqueID | string)[]
    ): Promise<MemoryModelCollection<T>> {
        const store = MemoryModel.getClassStore(this.name);
        const foundData: ModelData<T>[] = [];
        
        for (const id of ids) {
            const idString = typeof id === 'string' ? id : id.toString();
            const data = store.get(idString);
            if (data) {
                foundData.push(data as ModelData<T>);
            }
        }
        
        return new MemoryModelCollection(foundData, this);
    }

    public static async query<T extends BaseModel>(
        this: ModelConstructor<T>,
        query: (data: Record<string, unknown>) => boolean
    ): Promise<MemoryModelCollection<T>> {
        const store = MemoryModel.getClassStore(this.name);
        const matchingData: ModelData<T>[] = [];
                
        for (const data of store.values()) {
            if (query(data)) {
                matchingData.push(data as ModelData<T>);
            }
        }

        return new MemoryModelCollection(matchingData, this);
    }

    // Clear the entire memory store (useful for testing)
    public static clearStore(): void {
        MEMORY_STORE.clear();
    }

    // Clear store for a specific model class
    public static clearClassStore<T extends MemoryModel>(this: ModelConstructor<T>): void {
        MEMORY_STORE.delete(this.name);
    }
}
