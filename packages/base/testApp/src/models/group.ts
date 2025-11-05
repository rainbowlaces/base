import { MemoryModel } from '../data/memoryModel.js';
import { GroupType } from './groupType.js';
import { User } from './user.js';
import { field, model, referenceOne, referenceMany, type RefMany, type RefOne, thunk } from '../../../src/index.js';

@model
export class Group extends MemoryModel {
    @field()
    accessor name!: string;

    @referenceOne(thunk(() => GroupType))
    accessor type!: RefOne<GroupType>;

    @referenceMany(thunk(() => User))
    accessor members!: RefMany<User>;
}
