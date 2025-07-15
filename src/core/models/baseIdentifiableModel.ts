import { field } from "./decorators/field.js";
import { BaseModel } from "./baseModel.js";
import { UniqueID } from "./uniqueId.js";
import { BaseError } from "../baseErrors.js";
import { type BaseModelCollection } from "./baseModelCollection.js";
import { type ModelConstructor } from "./types.js";
import { toUniqueID } from "./hydrators.js";

/**
 * BaseIdentifiableModel extends BaseModel with an `id` field.
 */
export abstract class BaseIdentifiableModel extends BaseModel {
    @field({ 
        readOnly: true,
        default: () => new UniqueID(),
        hydrator: toUniqueID,
        serializer: (value: UniqueID) => value.toString() 
    })
    accessor id!: UniqueID;

    static async byId<T extends BaseIdentifiableModel>(
        this: ModelConstructor<T>,
        _id: UniqueID | string
    ): Promise<T | undefined> {
        throw new BaseError(`'${this.name}.byId' is not implemented. Override the static 'byId' method in your base class.`);
    }

    static async byIds<T extends BaseIdentifiableModel>(
        this: ModelConstructor<T>,
        _ids: (UniqueID | string)[]
    ): Promise<BaseModelCollection<T>> {
        throw new BaseError(`'${this.name}.byIds' is not implemented. Override the static 'byIds' method in your base class.`);
    }

}
