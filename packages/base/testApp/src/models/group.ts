import { MemoryModel } from '../data/memoryModel.js';
import { GroupType } from './groupType.js';
import { User } from './user.js';
import { field, model, reference, type RefMany, type RefOne, thunk } from '../../../src/index.js';

@model
export class Group extends MemoryModel {
    @field()
    accessor name!: string;

    @reference(thunk(() => GroupType), { cardinality: 'one' })
    accessor type!: RefOne<GroupType>;

    @reference(thunk(() => User), { cardinality: 'many' })
    accessor members!: RefMany<User>;
}
