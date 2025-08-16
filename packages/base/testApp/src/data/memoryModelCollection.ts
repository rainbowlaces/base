import { type BaseModel, BaseModelCollection, type ModelData } from "../../../src/index.js";
import { type Countable, type Slicable } from "../../../src/core/models/types.js";


export class MemoryModelCollection<T extends BaseModel> extends BaseModelCollection<T> implements Countable, Slicable {
    
    private async getSourceAsArray(): Promise<ModelData<T>[]> {
        const results: ModelData<T>[] = [];
        
        // Now we can safely access the protected source!
        if (Symbol.asyncIterator in this.source) {
            // Handle AsyncIterable
            for await (const item of this.source) {
                results.push(item);
            }
        } else {
            // Handle Iterable  
            for (const item of this.source) {
                results.push(item);
            }
        }
        
        return results;
    }

    public async count(): Promise<number> {
        const sourceArray = await this.getSourceAsArray();
        return sourceArray.length;
    }

    public async slice(offset: number, limit: number): Promise<this> {
        const sourceArray = await this.getSourceAsArray();
        const slicedData = sourceArray.slice(offset, offset + limit);
        // Return a new instance using the protected modelConstructor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new (this.constructor as any)(slicedData, this.modelConstructor) as this;
    }
}
