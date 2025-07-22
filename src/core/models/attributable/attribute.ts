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
        serializer: (value: string | number | boolean | Date | UniqueID): Scalar | object => {
            if (value instanceof UniqueID) {
                return value.toString();
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value as Scalar;
        },
        hydrator: (value: unknown): string | number | boolean | Date | UniqueID => {
            if (typeof value === 'string') {
                // Try to parse as Date first, then UniqueID
                const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
                if (dateMatch) {
                    return new Date(value);
                }
                // Check if it looks like a UniqueID (simple heuristic - 20 character string)
                if (value.length === 20) {
                    try {
                        return new UniqueID(value);
                    } catch {
                        // If it fails to create UniqueID, just return the string
                        return value;
                    }
                }
            }
            return value as string | number | boolean | Date | UniqueID;
        }
    })
    accessor value!: string | number | boolean | Date | UniqueID;

    @field({ 
        hydrator: (val: unknown) => new Date(val as string),
        default: () => new Date()
    })
    accessor created!: Date;
}
