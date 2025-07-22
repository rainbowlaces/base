import { MemoryModel } from '../data/memoryModel.js';
import { Comment } from './comment.js';
import { type Derived, embed, type EmbedMany, field, model, thunk } from '../../../src/index.js';
import { derived } from '../../../src/core/models/decorators/derived.js';

@model
export class Article extends MemoryModel {
    @field()
    accessor title!: string;

    @field()
    accessor content!: string;

    @embed(thunk(() => Comment), { cardinality: 'many' })
    accessor comments!: EmbedMany<Comment>;

    @derived()
    async status(): Derived<Promise<string>> {
        return "draft";
    }
}
