import { BaseModel } from '../baseModel.js';
import { field } from '../decorators/field.js';
import { model } from '../decorators/model.js';
import { UniqueID } from '../uniqueId.js';
import { type Scalar } from '../../types.js';

@model
export class Attribute extends BaseModel {
    @field()
    accessor name!: string;

    @field({
        serializer: (value: string | number | boolean | Date | UniqueID | object): Scalar | object => {
            if (value instanceof UniqueID) {
                return value.toString();
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            // For objects, return as-is (JSON serialization handled by persistence layer)
            if (typeof value === 'object' && value !== null) {
                return value;
            }
            return value as Scalar;
        },
        hydrator: (value: unknown): string | number | boolean | Date | UniqueID | object => {
            if (typeof value === 'string') {
                // Try to parse as Date first, then UniqueID
                const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
                if (dateMatch) {
                    return new Date(value);
                }
                // Check if it's a valid UniqueID format
                if (UniqueID.isValid(value)) {
                    return new UniqueID(value);
                }
            }
            // For objects, pass through as-is
            if (typeof value === 'object' && value !== null) {
                return value;
            }
            return value as string | number | boolean | Date | UniqueID;
        }
    })
    accessor value!: string | number | boolean | Date | UniqueID | object;

    @field({ 
        hydrator: (val: unknown) => new Date(val as string),
        default: () => new Date()
    })
    accessor created!: Date;
}
