import { BaseModel } from "./baseModel";
import { field } from "./decorators/field";
import { type ModelConstructor, type FindableById, type FindableByIds } from "./types";
import { type ModelCollection } from "./modelCollection";
import { UniqueID } from "./uniqueId";

export type IdentifiableModelClass<T extends IdentifiableModel<T>> = ModelConstructor<T> & typeof IdentifiableModel<T> & FindableById<T, UniqueID> & FindableByIds<T, UniqueID>;

export abstract class IdentifiableModel<T extends IdentifiableModel<T>> extends BaseModel<T> {

    @field<UniqueID>({ readOnly: true, default: () => new UniqueID() })
    accessor id!: UniqueID;

    /**
     * Retrieve a single model instance by its unique identifier.
     * This method must be implemented by concrete model classes.
     */
    public static async byId<T extends IdentifiableModel<T>>(this: IdentifiableModelClass<T>, _id: UniqueID): Promise<T | undefined> {
        throw new Error(`${this.name}.byId() must be implemented by concrete model class`);
    }

    /**
     * Retrieve multiple model instances by their unique identifiers.
     * This method must be implemented by concrete model classes.
     */
    public static async byIds<T extends IdentifiableModel<T>>(this: IdentifiableModelClass<T>, _ids: UniqueID[]): Promise<ModelCollection<T>> {
        throw new Error(`${this.name}.byIds() must be implemented by concrete model class`);
    }

}