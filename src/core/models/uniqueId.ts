import { customAlphabet } from 'nanoid';
import { BaseError } from "../baseErrors.js";
import { type Serializable } from '../types.js';

export class UniqueID implements Serializable {
    readonly #timestamp: number;
    readonly #random: string;

    private static readonly timestampLength = 9;
    private static readonly nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 15);

    constructor(id?: string | UniqueID | Date) {
        if (id instanceof UniqueID) {
            this.#timestamp = id.#timestamp;
            this.#random = id.#random;
            return;
        } else if (typeof id === 'string') {
            const { timestamp, random } = this.validateAndNormalize(id);
            this.#timestamp = timestamp;
            this.#random = random;
            return;
        } else if (id instanceof Date) {
            this.#timestamp = this.createFromDate(id);
            this.#random = UniqueID.nanoid();
            return;
        } else {
            this.#timestamp = this.createFromDate(new Date());
            this.#random = UniqueID.nanoid();
            return;
        }
    }

    private validateAndNormalize(id: string): { timestamp: number; random: string } {
        // This will throw with specific error messages if invalid
        UniqueID.isValid(id, true);

        // Extract timestamp part (first 9 chars) and random part (remaining chars)
        const timestampPart = id.substring(0, UniqueID.timestampLength);
        const random = id.substring(UniqueID.timestampLength);
        const timestamp = parseInt(timestampPart, 36);

        return { timestamp, random };
    }

    private createFromDate(date: Date): number {
        const timestamp = date.getTime();
        if (Number.isNaN(timestamp)) {
            throw new BaseError('Invalid date: not a real timestamp');
        }

        return timestamp;
    }

    public getTimestamp(): Date {
        return new Date(this.#timestamp);
    }

    private get timestamp(): string {
        return this.#timestamp.toString(36).padStart(UniqueID.timestampLength, '0');
    }

    public toString(): string {
        return `${this.timestamp}${this.#random}`;
    }

    public toJSON(): string {
        return this.toString();
    }

    public serialize(): string {
        return this.toString();
    }

    public equals(other: string | UniqueID): boolean {
        return this.toString() === other.toString();
    }

    /**
     * Check if a string is a valid UniqueID format
     */
    public static isValid(id: string, throws: boolean = false): boolean {
        try {
            // Check length
            if (id.length !== 24) {
                if (throws) {
                    throw new BaseError(`Invalid UniqueID length: expected 24, got ${id.length}`);
                }
                return false;
            }

            // Check that all characters are valid (0-9, a-z)
            if (!/^[0-9a-z]+$/.test(id)) {
                if (throws) {
                    throw new BaseError('Invalid UniqueID format: contains invalid characters');
                }
                return false;
            }

            // Check that timestamp part can be parsed as base36
            const timestampPart = id.substring(0, UniqueID.timestampLength);
            const timestamp = parseInt(timestampPart, 36);
            
            if (isNaN(timestamp)) {
                if (throws) {
                    throw new BaseError('Invalid UniqueID: timestamp part is not a valid base36 number');
                }
                return false;
            }

            return true;
        } catch (error) {
            if (throws && error instanceof BaseError) {
                throw error;
            }
            return false;
        }
    }
}