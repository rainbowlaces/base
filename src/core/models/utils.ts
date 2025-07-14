import { BaseIdentifiableModel } from "./baseIdentifiableModel.js";
import { type AsyncDefinedIds, type AsyncDefinedId, type DefinedId } from "./types.js";
import { UniqueID } from "./uniqueId.js";
import { BaseError } from "../baseErrors.js";

export function toUniqueId<T extends BaseIdentifiableModel>(id: DefinedId<T>) {
    if (id instanceof BaseIdentifiableModel) return id.id;
    if (id instanceof UniqueID) return id;
    if (typeof id === "string") return new UniqueID(id);
    throw new BaseError(
        `Invalid id type: ${typeof id}. Expected BaseIdentifiableModel, UniqueID, or string.`,
    );
}

export async function toUniqueIdAsync<T extends BaseIdentifiableModel>(
    id: AsyncDefinedId<T>,
): Promise<UniqueID> {
    id = await id;
    return toUniqueId<T>(id);
}

export function toUniqueIds<T extends BaseIdentifiableModel>(ids: DefinedId<T>[]): UniqueID[] {
    return ids.map((id) => toUniqueId<T>(id));
}

export async function toUniqueIdsAsync<T extends BaseIdentifiableModel>(
    ids: AsyncDefinedIds<T>,
): Promise<UniqueID[]> {
    const resolvedUniqueIds = await Promise.all(ids.map(id => toUniqueIdAsync(id)));
    return resolvedUniqueIds;
}
