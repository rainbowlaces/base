import { MemoryModel } from '../data/memoryModel.js';
import { Comment } from './comment.js';
import { embed, type EmbedMany, field, model, thunk } from '../../../src/index.js';

@model
export class Article extends MemoryModel {
    @field()
    accessor title!: string;

    @field()
    accessor content!: string;

    @embed(thunk(() => Comment), { cardinality: 'many' })
    accessor comments!: EmbedMany<Comment>;
}
