import { Attributable } from '../../../src/core/models/attributable/attributable.js';
import { type UniqueID } from '../../../src/core/models/uniqueId.js';
import { MemoryModel } from './memoryModel.js';
import { model } from '../../../src/core/models/decorators/model.js';
import { field } from '../../../src/core/models/decorators/field.js';

@model
export class Product extends Attributable(MemoryModel) {
    @field()
    accessor name!: string;
    
    @field()
    accessor price!: number;
}

// Type-safe attribute specification using declaration merging
declare module './product.js' {
    interface Product {
        Attributes: {
            // AttributeName: [TypeConstructor, Cardinality]
            color:          [StringConstructor, 'single'];
            isPublished:    [BooleanConstructor, 'single'];
            inventoryCount: [NumberConstructor, 'single'];
            tags:           [StringConstructor, 'many'];
            relatedProducts: [typeof UniqueID, 'many'];
        };
    }
}
