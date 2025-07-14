import { customAlphabet } from 'nanoid';
import { BaseError } from "../baseErrors.js";

export class UniqueID {
    readonly #id: string;
    private static readonly timestampLength = 9;
    private static readonly nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 11);

    constructor(id?: string | UniqueID) {
        if (id instanceof UniqueID) {
            this.#id = id.#id;
        } else if (typeof id === 'string') {
            this.#id = this.validateAndNormalize(id);
        } else {
            const timestamp = Date.now().toString(36).padStart(UniqueID.timestampLength, '0');
            const random = UniqueID.nanoid();
            this.#id = `${timestamp}${random}`;
        }
    }

    private validateAndNormalize(id: string): string {
        // Check length
        if (id.length !== 20) {
            throw new BaseError(`Invalid UniqueID length: expected 20, got ${id.length}`);
        }

        // Check that all characters are valid (0-9, a-z)
        if (!/^[0-9a-z]+$/.test(id)) {
            throw new BaseError('Invalid UniqueID format: contains invalid characters');
        }

        // Extract and validate timestamp part
        const timestampPart = id.substring(0, UniqueID.timestampLength);
        const timestamp = parseInt(timestampPart, 36);
        
        // Check if timestamp is a valid number
        if (isNaN(timestamp)) {
            throw new BaseError('Invalid UniqueID: timestamp part is not a valid base36 number');
        }

        // Check if timestamp represents a reasonable date (not before 2000 and not too far in future)
        const date = new Date(timestamp);
        const year2000 = new Date('2000-01-01').getTime();
        const futureLimit = Date.now() + (365 * 24 * 60 * 60 * 1000); // 1 year from now
        
        if (timestamp < year2000 || timestamp > futureLimit) {
            throw new BaseError(`Invalid UniqueID: timestamp ${date.toISOString()} is outside reasonable range`);
        }

        return id;
    }

    public getTimestamp(): Date {
        const timestampPart = this.#id.substring(0, UniqueID.timestampLength);
        return new Date(parseInt(timestampPart, 36));
    }

    public toString(): string {
        return this.#id;
    }

    public toJSON(): string {
        return this.#id;
    }

    public equals(other: string | UniqueID): boolean {
        return this.toString() === other.toString();
    }
}