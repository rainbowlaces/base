import { MemoryModel } from './memoryModel.js';
import { model } from '../../../src/core/models/decorators/model.js';
import { field } from '../../../src/core/models/decorators/field.js';

@model
export class Product extends MemoryModel {
    @field()
    accessor name!: string;
    
    @field()
    accessor price!: number;
}
