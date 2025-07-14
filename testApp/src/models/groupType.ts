import { field, model } from '../../../src/index.js';
import { MemoryModel } from '../data/memoryModel.js';

@model
export class GroupType extends MemoryModel {
    @field()
    accessor name!: string;

    @field()
    accessor description!: string;
}
