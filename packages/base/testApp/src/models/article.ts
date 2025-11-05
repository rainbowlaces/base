import { MemoryModel } from '../data/memoryModel.js';
import { Comment } from './comment.js';
import { embedMany, type EmbedMany, field, model, thunk } from '../../../src/index.js';

@model
export class Article extends MemoryModel {
    @field()
    accessor title!: string;

    @field()
    accessor content!: string;

    @embedMany(thunk(() => Comment))
    accessor comments!: EmbedMany<Comment>;

    async status(): Promise<string> {
        return "draft";
    }
}
