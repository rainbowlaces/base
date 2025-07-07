import { IdentifiableModel } from "./identifyableModel";
import { type AsyncDefinedIds, type AsyncDefinedId, type DefinedId } from "./types";
import { UniqueID } from "./uniqueId";

export function toUniqueId<T extends IdentifiableModel<T>>(id: DefinedId<T>) {
    if (id instanceof IdentifiableModel) return id.id;
    if (id instanceof UniqueID) return id;
    if (typeof id === "string") return new UniqueID(id);
    throw new Error(
        `Invalid id type: ${typeof id}. Expected IdentifiableModel, UniqueID, or string.`,
    );
}

export async function toUniqueIdAsync<T extends IdentifiableModel<T>>(
    id: AsyncDefinedId<T>,
): Promise<UniqueID> {
    id = await id;
    return toUniqueId<T>(id);
}

export function toUniqueIds<T extends IdentifiableModel<T>>(ids: DefinedId<T>[]): UniqueID[] {
    return ids.map((id) => toUniqueId<T>(id));
}

export async function toUniqueIdsAsync<T extends IdentifiableModel<T>>(
    ids: AsyncDefinedIds<T>,
): Promise<UniqueID[]> {
    const resolvedIds = await ids;
    return toUniqueIds<T>(resolvedIds);
}
