import { field } from "./decorators/field.js";
import { BaseModel } from "./baseModel.js";
import { UniqueID } from "./uniqueId.js";
import { BaseError } from "../baseErrors.js";
import { type BaseModelCollection } from "./baseModelCollection.js";
import { type ModelConstructor } from "./types.js";

/**
 * BaseIdentifiableModel extends BaseModel with an `id` field.
 * This removes the recursive generic constraint while providing identity.
 */
export abstract class BaseIdentifiableModel extends BaseModel {
    @field({ readOnly: true, default: () => new UniqueID() })
    accessor id!: UniqueID;

    /**
     * Find a model by its ID.
     * This is a generic static method that can be used on any identifiable model class.
     */
    static async byId<T extends BaseIdentifiableModel>(
        this: ModelConstructor<T>,
        _id: UniqueID | string
    ): Promise<T | undefined> {
        // Default implementation - should be overridden by concrete models
        // that implement Queryable interface
        throw new BaseError(`byId not implemented for ${this.name}. Implement Queryable interface.`);
    }

    /**
     * Find multiple models by their IDs.
     * This is a generic static method that can be used on any identifiable model class.
     */
    static async byIds<T extends BaseIdentifiableModel>(
        this: ModelConstructor<T>,
        _ids: (UniqueID | string)[]
    ): Promise<BaseModelCollection<T>> {
        // Default implementation - should be overridden by concrete models
        // that implement Queryable interface
        throw new BaseError(`byIds not implemented for ${this.name}. Implement Queryable interface.`);
    }

    /**
     * Create a new instance from data, ensuring the ID is properly set.
     * Inherits from BaseModel.fromData for now.
     */
    // static async fromData<T extends BaseIdentifiableModel>(
    //     this: ModelConstructor<T>,
    //     data: ModelData
    // ): Promise<T> {
    //     const instance = new this();
    //     await instance.hydrate(data);
    //     return instance;
    // }
}

// Type alias for backward compatibility
export type IdentifiableModel<T extends BaseIdentifiableModel> = T;
export type IdentifiableModelClass<T extends BaseIdentifiableModel> = typeof BaseIdentifiableModel & ModelConstructor<T>;
