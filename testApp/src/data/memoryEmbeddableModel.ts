import { BaseModel, type ModelData } from "../../../src/index.js";

export abstract class MemoryEmbeddableModel extends BaseModel {    
    // Public API to set model data
    public async setData(data: ModelData<this>): Promise<void> {
        await this.hydrate(data);
    }
}
