import { MemoryModel } from '../data/memoryModel.js';
import { Article } from './article.js';
import { model, field, referenceMany, thunk, type RefMany } from '../../../src/index.js';

@model
export class User extends MemoryModel {
    @field()
    accessor name!: string;

    @field()
    accessor email!: string;

    @field({ default: () => true })
    accessor active!: boolean;

    @field({ default: () => new Date() })
    accessor created!: Date;

    @referenceMany(thunk(() => Article))
    accessor bookmarks!: RefMany<Article>;
}
