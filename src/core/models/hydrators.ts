import { UniqueID } from "./uniqueId.js";
import { BaseError } from "../baseErrors.js";

/**
 * Common field hydrators for type transformation during hydration and setting
 */

/**
 * Converts a value to UniqueID. Handles strings, existing UniqueIDs, and throws for invalid types.
 */
export function toUniqueID(value: unknown): UniqueID {
    if (value instanceof UniqueID) {
        return value;
    }
    if (typeof value === 'string') {
        return new UniqueID(value);
    }
    throw new BaseError(`Cannot convert ${typeof value} to UniqueID`);
}

/**
 * Converts a value to Date. Handles Date objects, strings, numbers, and throws for invalid types.
 */
export function toDate(value: unknown): Date {
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            throw new BaseError(`Cannot convert value to valid Date: ${String(value)}`);
        }
        return date;
    }
    throw new BaseError(`Cannot convert ${typeof value} to Date`);
}

/**
 * Converts a value to number. Handles numbers, numeric strings, and throws for invalid types.
 */
export function toNumber(value: unknown): number {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        if (value.trim() === '') {
            throw new BaseError(`Cannot convert string "${value}" to number`);
        }
        const num = Number(value);
        if (isNaN(num)) {
            throw new BaseError(`Cannot convert string "${value}" to number`);
        }
        return num;
    }
    throw new BaseError(`Cannot convert ${typeof value} to number`);
}

/**
 * Converts a value to string. Handles all primitive types safely.
 */
export function toString(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (value === null || value === undefined) {
        throw new BaseError(`Cannot convert ${value} to string`);
    }
    if (typeof value === 'object') {
        throw new BaseError(`Cannot convert object to string`);
    }
    throw new BaseError(`Cannot convert ${typeof value} to string`);
}

/**
 * Converts a value to boolean. Handles booleans, strings ('true'/'false'), numbers (0/non-0).
 */
export function toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        
        // Truthy values
        if (lower === 'true' || lower === 'yes' || lower === '1' || lower === 'on') {
            return true;
        }
        
        // Falsy values  
        if (lower === 'false' || lower === 'no' || lower === '0' || lower === 'off' || lower === '') {
            return false;
        }
        
        throw new BaseError(`Cannot convert string "${value}" to boolean`);
    }
    throw new BaseError(`Cannot convert ${typeof value} to boolean`);
}
