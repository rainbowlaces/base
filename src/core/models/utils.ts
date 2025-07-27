import { UniqueID } from "./uniqueId.js";
import { BaseError } from "../baseErrors.js";

// Interface for objects that have an id property
export interface Identifiable {
    id: UniqueID | string;
}

// Type for values that can be converted to UniqueID
export type DefinedId<T extends Identifiable> = T | UniqueID | string;
export type AsyncDefinedId<T extends Identifiable> = DefinedId<T> | Promise<DefinedId<T>>;
export type AsyncDefinedIds<T extends Identifiable> = DefinedId<T>[] | Promise<DefinedId<T>[]>;

export function toUniqueId<T extends Identifiable>(id: DefinedId<T>): UniqueID {
    if (id && typeof id === "object" && "id" in id) {
        const identifiable = id as Identifiable;
        return identifiable.id instanceof UniqueID ? identifiable.id : new UniqueID(identifiable.id);
    }
    if (id instanceof UniqueID) return id;
    if (typeof id === "string") return new UniqueID(id);
    throw new BaseError(
        `Invalid id type: ${typeof id}. Expected Identifiable object, UniqueID, or string.`,
    );
}

export async function toUniqueIdAsync<T extends Identifiable>(
    id: AsyncDefinedId<T>,
): Promise<UniqueID> {
    const resolvedId = await id;
    return toUniqueId<T>(resolvedId);
}

export function toUniqueIds<T extends Identifiable>(ids: DefinedId<T>[]): UniqueID[] {
    return ids.map((id) => toUniqueId<T>(id));
}

export async function toUniqueIdsAsync<T extends Identifiable>(
    ids: AsyncDefinedIds<T>,
): Promise<UniqueID[]> {
    const resolvedIds = await ids;
    return toUniqueIds<T>(resolvedIds);
}
