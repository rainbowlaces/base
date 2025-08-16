import { model, reference, thunk, type RefOne, field } from '../../../src/index.js';
import { MemoryEmbeddableModel } from '../data/memoryEmbeddableModel.js';
import { User } from './user.js';

@model
export class Comment extends MemoryEmbeddableModel {
    @reference(thunk(() => User), { cardinality: 'one' })
    accessor author!: RefOne<User>;

    @field()
    accessor text!: string;

    @field({ default: () => new Date() })
    accessor postedAt!: Date;
}
