import { describe, it, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../../src/core/models/baseModel.js';
import { embedMap } from '../../../../src/core/models/decorators/embedMap.js';
import { model } from '../../../../src/core/models/decorators/model.js';
import { field } from '../../../../src/core/models/decorators/field.js';
import { type EmbedMap } from '../../../../src/core/models/types.js';
import { setupTestTeardown, TestComment } from '../setup.js';
import { thunk } from '../../../../src/utils/thunk.js';

// Setup test isolation
setupTestTeardown();

describe('@embedMap decorator', () => {
    it('should create function-like accessor for embedded map', () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        assert(typeof post.comments === 'function', 'Should create function accessor');
    });

    it('should apply field options', () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment, { readOnly: true })
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        assert(typeof post.comments === 'function', 'Should create accessor with options');
    });

    it('should throw on direct assignment', () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        assert.throws(() => {
            (post as any).comments = 'invalid';
        }, 'Should prevent direct assignment');
    });

    it('should have proper property descriptor', () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const descriptor = Object.getOwnPropertyDescriptor(TestPost.prototype, 'comments');
        assert(descriptor, 'Should have property descriptor');
        assert(typeof descriptor.get === 'function', 'Should have getter');
        assert(typeof descriptor.set === 'function', 'Should have setter');
    });

    it('should return empty Map when no data is set', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        const result = await post.comments();

        assert(result instanceof Map, 'Should return a Map');
        assert.strictEqual(result.size, 0, 'Should return empty map');
    });

    it('should handle undefined/null as empty map', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        
        await post.comments(undefined as any);
        let result = await post.comments();
        assert.strictEqual(result.size, 0, 'Should handle undefined as empty map');

        await post.comments(null as any);
        result = await post.comments();
        assert.strictEqual(result.size, 0, 'Should handle null as empty map');
    });

    it('should set and get a Map of embedded models', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        const comment1 = new TestComment();
        const comment2 = new TestComment();
        
        mock.method(comment1, 'serialize', () => ({ content: 'Comment 1' }));
        mock.method(comment2, 'serialize', () => ({ content: 'Comment 2' }));

        const inputMap = new Map<string, TestComment>([
            ['first', comment1],
            ['second', comment2]
        ]);

        await post.comments(inputMap);

        // Verify internal storage is a plain object using serialize
        const serialized = post.serialize();
        const internalData = (serialized as any).comments;
        assert(typeof internalData === 'object', 'Should store as plain object');
        assert(!Array.isArray(internalData), 'Should not be an array');
        assert(!(internalData instanceof Map), 'Should not be a Map instance');
        assert('first' in internalData, 'Should have first key');
        assert('second' in internalData, 'Should have second key');
    });

    it('should deserialize and hydrate models when getting', async () => {
        const mockComment1 = new TestComment();
        const mockComment2 = new TestComment();
        
        const fromDataSpy = mock.method(TestComment, 'fromData', async (data: any) => {
            if (data.content === 'Comment 1') return mockComment1;
            if (data.content === 'Comment 2') return mockComment2;
            throw new Error('Unexpected data');
        });

        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        post.set('comments', {
            'first': { content: 'Comment 1' },
            'second': { content: 'Comment 2' }
        });

        const result = await post.comments();

        assert(result instanceof Map, 'Should return a Map');
        assert.strictEqual(result.size, 2, 'Should have 2 entries');
        assert.strictEqual(result.get('first'), mockComment1, 'Should have hydrated first comment');
        assert.strictEqual(result.get('second'), mockComment2, 'Should have hydrated second comment');
        assert.strictEqual(fromDataSpy.mock.callCount(), 2, 'Should call fromData twice');
    });

    it('should serialize Map to plain object during hydration', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        // Use plain data objects, not model instances with mocks
        const post = await TestPost.fromData({
            comments: {
                'alpha': { content: 'Comment 1' },
                'beta': { content: 'Comment 2' }
            }
        } as any);

        // Use serialize() to check internal storage format
        const serialized = post.serialize();
        assert.deepStrictEqual((serialized as any).comments, {
            'alpha': { content: 'Comment 1' },
            'beta': { content: 'Comment 2' }
        }, 'Should serialize Map during hydration');
    });

    it('should handle Record<string, ModelData<T>> during hydration', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = await TestPost.fromData({
            comments: {
                'key1': { content: 'Value 1' },
                'key2': { content: 'Value 2' }
            }
        } as any);

        const serialized = post.serialize();
        const internalData = (serialized as any).comments;
        assert.deepStrictEqual(internalData, {
            'key1': { content: 'Value 1' },
            'key2': { content: 'Value 2' }
        }, 'Should handle plain object during hydration');
    });

    it('should work with serialize() method', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        post.set('comments', {
            'a': { content: 'A' },
            'b': { content: 'B' }
        });

        const serialized = post.serialize();
        
        assert.deepStrictEqual((serialized as any).comments, {
            'a': { content: 'A' },
            'b': { content: 'B' }
        }, 'Should serialize to plain object');
    });

    it('should work with thunk model reference', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(thunk(() => TestComment))
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        const result = await post.comments();
        
        assert(result instanceof Map, 'Should work with thunk reference');
    });

    it('should handle default values as plain objects', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment, {
                default: () => ({
                    'default': { content: 'Default comment' }
                })
            })
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        const serialized = post.serialize();
        const internalData = (serialized as any).comments;
        
        assert.deepStrictEqual(internalData, {
            'default': { content: 'Default comment' }
        }, 'Default should be stored as plain object');
    });

    it('should integrate with fromData() factory', async () => {
        const mockComment = new TestComment();
        mock.method(TestComment, 'fromData', () => Promise.resolve(mockComment));

        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = await TestPost.fromData({
            comments: {
                'test': { content: 'Test' }
            }
        } as any);

        const result = await post.comments();
        assert(result instanceof Map, 'Should return Map from fromData');
        assert.strictEqual(result.size, 1, 'Should have one entry');
        assert(result.has('test'), 'Should have test key');
    });

    it('should preserve string keys (no coercion)', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        post.set('comments', {
            '123': { content: 'Numeric string key' },
            'abc': { content: 'Text key' }
        });

        const mockComment = new TestComment();
        mock.method(TestComment, 'fromData', () => Promise.resolve(mockComment));

        const result = await post.comments();
        
        assert(result.has('123'), 'Should preserve numeric string keys');
        assert(result.has('abc'), 'Should have text key');
        assert(!result.has(123 as any), 'Should not have numeric key');
    });

    it('should handle empty object as empty map', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = await TestPost.fromData({
            comments: {}
        } as any);

        const result = await post.comments();
        assert.strictEqual(result.size, 0, 'Should handle empty object as empty map');
    });
});

describe('BaseModel: Map Helper Methods', () => {
    it('should set a value in map using setInMap()', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        const comment = new TestComment();
        mock.method(comment, 'serialize', () => ({ content: 'Test comment' }));

        post.setInMap('comments', 'first', comment);

        const serialized = post.serialize();
        assert.deepStrictEqual((serialized as any).comments, {
            'first': { content: 'Test comment' }
        }, 'Should set value in map');
    });

    it('should accept serialized data in setInMap()', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        post.setInMap('comments', 'key1', { content: 'Direct data' } as any);

        const serialized = post.serialize();
        assert.deepStrictEqual((serialized as any).comments, {
            'key1': { content: 'Direct data' }
        }, 'Should accept serialized data');
    });

    it('should update existing value in setInMap()', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        post.setInMap('comments', 'key1', { content: 'First' } as any);
        post.setInMap('comments', 'key1', { content: 'Updated' } as any);

        const serialized = post.serialize();
        assert.deepStrictEqual((serialized as any).comments, {
            'key1': { content: 'Updated' }
        }, 'Should update existing value');
    });

    it('should get a value from map using getFromMap()', async () => {
        const mockComment = new TestComment();
        mock.method(TestComment, 'fromData', () => Promise.resolve(mockComment));

        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        post.setInMap('comments', 'test', { content: 'Test' } as any);

        const result = await post.getFromMap('comments', 'test');
        assert.strictEqual(result, mockComment, 'Should return hydrated model');
    });

    it('should return undefined for non-existent key in getFromMap()', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        const result = await post.getFromMap('comments', 'nonexistent');
        assert.strictEqual(result, undefined, 'Should return undefined for missing key');
    });

    it('should delete a value from map using deleteFromMap()', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        post.setInMap('comments', 'key1', { content: 'First' } as any);
        post.setInMap('comments', 'key2', { content: 'Second' } as any);

        const deleted = post.deleteFromMap('comments', 'key1');
        assert.strictEqual(deleted, true, 'Should return true when deleting existing key');

        const serialized = post.serialize();
        assert.deepStrictEqual((serialized as any).comments, {
            'key2': { content: 'Second' }
        }, 'Should remove key from map');
    });

    it('should return false when deleting non-existent key', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        const deleted = post.deleteFromMap('comments', 'nonexistent');
        assert.strictEqual(deleted, false, 'Should return false for non-existent key');
    });

    it('should check if key exists using hasInMap()', async () => {
        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        post.setInMap('comments', 'exists', { content: 'Test' } as any);

        assert.strictEqual(post.hasInMap('comments', 'exists'), true, 'Should return true for existing key');
        assert.strictEqual(post.hasInMap('comments', 'missing'), false, 'Should return false for missing key');
    });

    it('should throw error when using map helpers on non-map fields', async () => {
        @model
        class TestPost extends BaseModel {
            @field()
            accessor regularField!: string;
        }

        const post = new TestPost();

        assert.throws(() => {
            post.setInMap('regularField' as any, 'key', 'value' as any);
        }, /can only be used on an 'embedMap' field/, 'setInMap should throw on non-map field');

        await assert.rejects(async () => {
            await post.getFromMap('regularField' as any, 'key');
        }, /can only be used on an 'embedMap' field/, 'getFromMap should throw on non-map field');

        assert.throws(() => {
            post.deleteFromMap('regularField' as any, 'key');
        }, /can only be used on an 'embedMap' field/, 'deleteFromMap should throw on non-map field');

        assert.throws(() => {
            post.hasInMap('regularField' as any, 'key');
        }, /can only be used on an 'embedMap' field/, 'hasInMap should throw on non-map field');
    });

    it('should work with multiple operations in sequence', async () => {
        const mockComment = new TestComment();
        mock.method(TestComment, 'fromData', () => Promise.resolve(mockComment));

        @model
        class TestPost extends BaseModel {
            @embedMap(TestComment)
            accessor comments!: EmbedMap<TestComment>;
        }

        const post = new TestPost();
        
        // Set multiple values
        post.setInMap('comments', 'a', { content: 'A' } as any);
        post.setInMap('comments', 'b', { content: 'B' } as any);
        post.setInMap('comments', 'c', { content: 'C' } as any);

        // Check existence
        assert.strictEqual(post.hasInMap('comments', 'a'), true);
        assert.strictEqual(post.hasInMap('comments', 'b'), true);
        assert.strictEqual(post.hasInMap('comments', 'c'), true);

        // Delete one
        post.deleteFromMap('comments', 'b');
        assert.strictEqual(post.hasInMap('comments', 'b'), false);

        // Get one
        const result = await post.getFromMap('comments', 'a');
        assert.strictEqual(result, mockComment);

        // Check final state
        const serialized = post.serialize();
        assert.deepStrictEqual((serialized as any).comments, {
            'a': { content: 'A' },
            'c': { content: 'C' }
        });
    });
});
