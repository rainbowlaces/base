import { customAlphabet } from 'nanoid';
import { createHash } from 'crypto';
import { BaseError } from "../baseErrors.js";
import { type Serializable } from '../types.js';

type IDType = 'TIME_BASED' | 'HASH_BASED';

export class UniqueID implements Serializable {
    readonly #value: string;
    readonly #type: IDType;

    // --- Static Properties ---
    private static readonly hashPrefix = 'z';
    private static readonly totalLength = 24;
    private static readonly timestampLength = 9;
    private static readonly randomLength = 15;
    private static readonly hashLength = UniqueID.totalLength - UniqueID.hashPrefix.length;
    
    private static readonly forbiddenTimestamp = parseInt(`${UniqueID.hashPrefix}00000000`, 36);

    private static readonly nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', UniqueID.randomLength);

    // --- Constructor ---
    constructor(id?: string | UniqueID | Date) {
        if (id instanceof UniqueID) {
            this.#value = id.#value;
            this.#type = id.#type;
            return;
        }

        if (typeof id === 'string') {
            const { type, value } = this.validateAndNormalize(id);
            this.#value = value;
            this.#type = type;
            return;
        }
        
        // Handle Date or empty constructor
        const timestamp = this.createFromDate(id instanceof Date ? id : new Date());
        const timestampStr = timestamp.toString(36).padStart(UniqueID.timestampLength, '0');
        
        this.#value = `${timestampStr}${UniqueID.nanoid()}`;
        this.#type = 'TIME_BASED';
    }
    
    /**
     * Creates a UniqueID from various inputs.
     * - If input is a string, creates a deterministic, hash-based ID.
     * - If input is a Date, creates a time-based ID for that specific time.
     */
    public static from(input: string | Date): UniqueID {
        if (typeof input === 'string') {
            const hashBuffer = createHash('sha256').update(input).digest();
            const hashAsBigInt = BigInt(`0x${hashBuffer.toString('hex')}`);
            const base36Hash = hashAsBigInt.toString(36);
            const truncatedHash = base36Hash.padStart(UniqueID.hashLength, '0').substring(0, UniqueID.hashLength);
            const finalId = `${UniqueID.hashPrefix}${truncatedHash}`;
            return new UniqueID(finalId);
        }
        
        // If it's not a string, it's a Date. Delegate to the constructor.
        // The validation is handled inside createFromDate, called by the constructor.
        return new UniqueID(input);
    }

    // --- Private Helpers ---
    private validateAndNormalize(id: string): { type: IDType, value: string } {
        UniqueID.isValid(id, true);
        
        if (id.startsWith(UniqueID.hashPrefix)) {
            return { type: 'HASH_BASED', value: id };
        } else {
            return { type: 'TIME_BASED', value: id };
        }
    }

    private createFromDate(date: Date): number {
        const timestamp = date.getTime();

        // Hard limit to prevent collision with the 'h' prefix in the distant future.
        if (timestamp >= UniqueID.forbiddenTimestamp) {
            throw new BaseError(`Date cannot be on or after 20 Nov 3489 to avoid ID type collision.`);
        }

        if (Number.isNaN(timestamp)) {
            throw new BaseError('Invalid date: not a real timestamp');
        }
        return timestamp;
    }
    
    // ... rest of the methods (getTimestamp, getType, toString, isValid, etc.) are unchanged ...
    
    public getTimestamp(): Date {
        if (this.#type !== 'TIME_BASED') {
            throw new BaseError('Cannot get timestamp from a hash-based UniqueID.');
        }
        const timestampPart = this.#value.substring(0, UniqueID.timestampLength);
        const timestamp = parseInt(timestampPart, 36);
        return new Date(timestamp);
    }
    
    public getType(): IDType {
        return this.#type;
    }

    public toString(): string {
        return this.#value;
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

    public static isValid(id: string, throws: boolean = false): boolean {
        try {
            if (id.length !== UniqueID.totalLength) {
                if (throws) throw new BaseError(`Invalid UniqueID length: expected ${UniqueID.totalLength}, got ${id.length}`);
                return false;
            }

            if (!/^[0-9a-z]+$/.test(id)) {
                if (throws) throw new BaseError('Invalid UniqueID format: contains invalid characters');
                return false;
            }

            if (id.startsWith(UniqueID.hashPrefix)) {
                return true;
            } else {
                const timestampPart = id.substring(0, UniqueID.timestampLength);
                const timestamp = parseInt(timestampPart, 36);
                if (isNaN(timestamp)) {
                    if (throws) throw new BaseError('Invalid UniqueID: timestamp part is not a valid base36 number');
                    return false;
                }
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