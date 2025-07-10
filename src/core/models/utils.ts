import { BaseIdentifiableModel } from "./baseIdentifiableModel";
import { type AsyncDefinedIds, type AsyncDefinedId, type DefinedId } from "./types";
import { UniqueID } from "./uniqueId";

export function toUniqueId<T extends BaseIdentifiableModel>(id: DefinedId<T>) {
    if (id instanceof BaseIdentifiableModel) return id.id;
    if (id instanceof UniqueID) return id;
    if (typeof id === "string") return new UniqueID(id);
    throw new Error(
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
