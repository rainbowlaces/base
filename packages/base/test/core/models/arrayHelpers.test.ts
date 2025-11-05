import { describe, it, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../src/core/models/baseModel.js';
import { embed } from '../../../src/core/models/decorators/embed.js';
import { model } from '../../../src/core/models/decorators/model.js';
import { field } from '../../../src/core/models/decorators/field.js';
import { type EmbedMany } from '../../../src/core/models/types.js';
import { setupTestTeardown, TestComment } from './setup.js';

// Setup test isolation
setupTestTeardown();

describe('BaseModel: Array Helper Methods', () => {
    describe('getFromArray', () => {
        it('should get item at specific index', async () => {
            const mockComment = new TestComment();
            mock.method(TestComment, 'fromData', () => Promise.resolve(mockComment));

            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;

                async getComment(index: number) {
                    return this.getFromArray('comments', index);
                }
            }

            const post = new TestPost();
            post.set('comments', [
                { content: 'First' },
                { content: 'Second' },
                { content: 'Third' }
            ]);

            const result = await post.getComment(1);
            assert.strictEqual(result, mockComment, 'Should return item at index');
        });

        it('should return undefined for out of bounds index', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;

                async getComment(index: number) {
                    return this.getFromArray('comments', index);
                }
            }

            const post = new TestPost();
            post.set('comments', [{ content: 'First' }]);

            const result = await post.getComment(5);
            assert.strictEqual(result, undefined, 'Should return undefined for out of bounds');
        });

        it('should throw on non-array field', async () => {
            @model
            class TestPost extends BaseModel {
                @field()
                accessor title!: string;

                async getTitle(index: number) {
                    return this.getFromArray('title' as any, index);
                }
            }

            const post = new TestPost();
            
            await assert.rejects(
                async () => await post.getTitle(0),
                /can only be used on an 'embedMany' or 'refMany' field/
            );
        });
    });

    describe('setInArray', () => {
        it('should update item at specific index', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [
                { content: 'First' },
                { content: 'Second' },
                { content: 'Third' }
            ]);

            const newComment = new TestComment();
            mock.method(newComment, 'serialize', () => ({ content: 'Updated' }));

            (post as any).setInArray('comments', 1, newComment);

            const serialized = post.serialize();
            assert.deepStrictEqual((serialized as any).comments, [
                { content: 'First' },
                { content: 'Updated' },
                { content: 'Third' }
            ]);
        });

        it('should accept serialized data', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [{ content: 'First' }]);

            (post as any).setInArray('comments', 0, { content: 'Updated' } as any);

            const serialized = post.serialize();
            assert.deepStrictEqual((serialized as any).comments, [
                { content: 'Updated' }
            ]);
        });

        it('should throw for out of bounds index', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [{ content: 'First' }]);

            assert.throws(
                () => (post as any).setInArray('comments', 5, { content: 'Bad' } as any),
                /Index 5 is out of bounds/
            );
        });
    });

    describe('deleteFromArray', () => {
        it('should delete item at specific index', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [
                { content: 'First' },
                { content: 'Second' },
                { content: 'Third' }
            ]);

            const deleted = (post as any).deleteFromArray('comments', 1);
            assert.strictEqual(deleted, true, 'Should return true');

            const serialized = post.serialize();
            assert.deepStrictEqual((serialized as any).comments, [
                { content: 'First' },
                { content: 'Third' }
            ]);
        });

        it('should return false for out of bounds index', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [{ content: 'First' }]);

            const deleted = (post as any).deleteFromArray('comments', 5);
            assert.strictEqual(deleted, false, 'Should return false');
        });
    });

    describe('hasInArray', () => {
        it('should return true for valid index', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [
                { content: 'First' },
                { content: 'Second' }
            ]);

            assert.strictEqual((post as any).hasInArray('comments', 0), true);
            assert.strictEqual((post as any).hasInArray('comments', 1), true);
        });

        it('should return false for out of bounds index', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [{ content: 'First' }]);

            assert.strictEqual((post as any).hasInArray('comments', 5), false);
            assert.strictEqual((post as any).hasInArray('comments', -1), false);
        });
    });

    describe('findInArray', () => {
        it('should find first matching item', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [
                { content: 'First comment' },
                { content: 'Second comment' },
                { content: 'Third comment' }
            ]);

            // Mock fromData to return distinct instances
            let callCount = 0;
            const comments = [
                new TestComment(),
                new TestComment(),
                new TestComment()
            ];
            mock.method(TestComment, 'fromData', () => {
                return Promise.resolve(comments[callCount++]);
            });

            const result = await (post as any).findInArray('comments', (_item: TestComment, index: number) => {
                return index === 1;
            });

            assert.strictEqual(result, comments[1], 'Should return second comment');
        });

        it('should return undefined when no match found', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [{ content: 'First' }]);

            mock.method(TestComment, 'fromData', () => Promise.resolve(new TestComment()));

            const result = await (post as any).findInArray('comments', () => false);

            assert.strictEqual(result, undefined);
        });

        it('should support async predicates', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [
                { content: 'First' },
                { content: 'Second' }
            ]);

            const targetComment = new TestComment();
            let callCount = 0;
            const comments = [new TestComment(), targetComment];
            mock.method(TestComment, 'fromData', () => {
                return Promise.resolve(comments[callCount++]);
            });

            const result = await (post as any).findInArray('comments', async (_item: TestComment, index: number) => {
                await Promise.resolve();
                return index === 1;
            });

            assert.strictEqual(result, targetComment);
        });
    });

    describe('filterArray', () => {
        it('should filter items matching predicate', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [
                { content: 'Important: First' },
                { content: 'Second' },
                { content: 'Important: Third' }
            ]);

            const comments = [new TestComment(), new TestComment(), new TestComment()];
            let callCount = 0;
            mock.method(TestComment, 'fromData', () => {
                return Promise.resolve(comments[callCount++]);
            });

            const results = await (post as any).filterArray('comments', (_item: TestComment, index: number) => {
                return index === 0 || index === 2; // First and third
            });

            assert.strictEqual(results.length, 2);
            assert.strictEqual(results[0], comments[0]);
            assert.strictEqual(results[1], comments[2]);
        });

        it('should return empty array when no matches', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [{ content: 'First' }]);

            mock.method(TestComment, 'fromData', () => Promise.resolve(new TestComment()));

            const results = await (post as any).filterArray('comments', () => false);

            assert.strictEqual(results.length, 0);
        });

        it('should support async predicates', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [
                { content: 'First' },
                { content: 'Second' }
            ]);

            const comments = [new TestComment(), new TestComment()];
            let callCount = 0;
            mock.method(TestComment, 'fromData', () => {
                return Promise.resolve(comments[callCount++]);
            });

            const results = await (post as any).filterArray('comments', async (_item: TestComment, index: number) => {
                await Promise.resolve();
                return index === 0;
            });

            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0], comments[0]);
        });

        it('should pass index to predicate', async () => {
            @model
            class TestPost extends BaseModel {
                @embed(TestComment, { cardinality: 'many' })
                accessor comments!: EmbedMany<TestComment>;
            }

            const post = new TestPost();
            post.set('comments', [
                { content: 'First' },
                { content: 'Second' },
                { content: 'Third' }
            ]);

            const comments = [new TestComment(), new TestComment(), new TestComment()];
            let callCount = 0;
            mock.method(TestComment, 'fromData', () => {
                return Promise.resolve(comments[callCount++]);
            });

            const results = await (post as any).filterArray('comments', (_item: TestComment, index: number) => {
                return index % 2 === 0; // Even indices only
            });

            assert.strictEqual(results.length, 2);
            assert.strictEqual(results[0], comments[0]);
            assert.strictEqual(results[1], comments[2]);
        });
    });

    describe('Integration tests', () => {
        it('should work with all array operations in sequence', async () => {
            @model
            class TestItem extends BaseModel {
                @field()
                accessor value!: string;
            }

            @model
            class TestContainer extends BaseModel {
                @embed(TestItem, { cardinality: 'many' })
                accessor items!: EmbedMany<TestItem>;

                async addItems(items: any[]): Promise<void> {
                    return this.appendTo('items', items);
                }
            }

            const container = new TestContainer();
            
            // Use helper method to add items
            await container.addItems([
                { value: 'First' },
                { value: 'Second' },
                { value: 'Third' }
            ] as any);

            // Check array length
            assert.strictEqual((container as any).hasInArray('items', 2), true);
            assert.strictEqual((container as any).hasInArray('items', 3), false);

            // Update middle item
            (container as any).setInArray('items', 1, { value: 'Updated Second' } as any);

            // Delete last item
            const deleted = (container as any).deleteFromArray('items', 2);
            assert.strictEqual(deleted, true);

            // Verify final state
            const serialized = container.serialize();
            assert.deepStrictEqual((serialized as any).items, [
                { value: 'First' },
                { value: 'Updated Second' }
            ]);
        });
    });
});
