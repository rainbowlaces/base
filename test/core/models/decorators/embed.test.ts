import { describe, it, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../../src/core/models/baseModel.js';
import { embed } from '../../../../src/core/models/decorators/embed.js';
import { model } from '../../../../src/core/models/decorators/model.js';
import { type EmbedOne, type EmbedMany } from '../../../../src/core/models/types.js';
import { setupTestTeardown, TestComment } from '../setup.js';
import { thunk } from '../../../../src/utils/thunk.js';

// Setup test isolation
setupTestTeardown();

describe('@embed decorator', () => {
    it('should create function-like accessor for embedded models', () => {
        @model
        class TestPost extends BaseModel {
            @embed(TestComment, { cardinality: 'one' })
            accessor comment!: EmbedOne<TestComment>;
        }

        const post = new TestPost();
        assert(typeof post.comment === 'function', 'Should create function accessor');
    });

    it('should handle one and many cardinality for embedded models', () => {
        @model
        class TestPost extends BaseModel {
            @embed(TestComment, { cardinality: 'one' })
            accessor comment!: EmbedOne<TestComment>;

            @embed(TestComment, { cardinality: 'many' })
            accessor comments!: EmbedMany<TestComment>;
        }

        const post = new TestPost();
        assert(typeof post.comment === 'function', 'One embed should be function');
        assert(typeof post.comments === 'function', 'Many embed should be function');
    });

    it('should apply field options', () => {
        @model
        class TestPost extends BaseModel {
            @embed(TestComment, { 
                cardinality: 'one', 
                readOnly: true 
            })
            accessor comment!: EmbedOne<TestComment>;
        }

        const post = new TestPost();
        assert(typeof post.comment === 'function', 'Should create accessor with options');
    });

    it('should throw on direct assignment', () => {
        @model
        class TestPost extends BaseModel {
            @embed(TestComment, { cardinality: 'one' })
            accessor comment!: EmbedOne<TestComment>;
        }

        const post = new TestPost();
        assert.throws(() => {
            (post as any).comment = 'invalid';
        }, 'Should prevent direct assignment');
    });

    it('should have proper property descriptor', () => {
        @model
        class TestPost extends BaseModel {
            @embed(TestComment, { cardinality: 'one' })
            accessor comment!: EmbedOne<TestComment>;
        }

        const descriptor = Object.getOwnPropertyDescriptor(TestPost.prototype, 'comment');
        assert(descriptor, 'Should have property descriptor');
        assert(typeof descriptor.get === 'function', 'Should have getter');
        assert(typeof descriptor.set === 'function', 'Should have setter');
    });

    it('should work with default values', () => {
        @model
        class TestPost extends BaseModel {
            @embed(TestComment, { 
                cardinality: 'one',
                default: () => ({ content: 'Default comment' } as any)
            })
            accessor comment!: EmbedOne<TestComment>;
        }

        const post = new TestPost();
        assert(typeof post.comment === 'function', 'Should create accessor with default');
    });

    it('should handle many-to-many embedding patterns', () => {
        @model
        class TestPost extends BaseModel {
            @embed(TestComment, { cardinality: 'many' })
            accessor comments!: EmbedMany<TestComment>;
        }

        const post = new TestPost();
        assert(typeof post.comments === 'function', 'Should handle embedded collections');
    });

    it('EmbedOne should call model.fromData() correctly', async () => {
        // Mock the fromData method to return a mock comment instead of throwing
        const mockComment = new TestComment();
        const fromDataSpy = mock.method(TestComment, 'fromData', () => Promise.resolve(mockComment));

        @model
        class TestPost extends BaseModel {
            @embed(TestComment, { cardinality: 'one' })
            accessor comment!: EmbedOne<TestComment>;
        }

        const post = new TestPost();
        const commentData = { content: 'Test comment' };
        post.set('comment', commentData);

        const result = await post.comment();

        assert.strictEqual(fromDataSpy.mock.callCount(), 1, 'TestComment.fromData should be called once');
        assert.deepStrictEqual(fromDataSpy.mock.calls[0].arguments, [commentData], 'TestComment.fromData should be called with the correct data');
        assert.strictEqual(result, mockComment, 'Should return the comment from fromData');
    });

    it('EmbedOne setter should call post.set() with serialized comment data', async () => {
        @model
        class TestPost extends BaseModel {
            @embed(TestComment, { cardinality: 'one' })
            accessor comment!: EmbedOne<TestComment>;
        }

        const post = new TestPost();
        const setSpy = mock.method(post as any, '_internalSet');
        const comment = new TestComment();
        const serializedData = { content: 'Serialized comment' };
        
        // Mock the serialize method to return known data
        const serializeSpy = mock.method(comment, 'serialize', () => serializedData);

        await post.comment(comment);

        assert.strictEqual(serializeSpy.mock.callCount(), 1, 'comment.serialize should be called once');
        assert.strictEqual(setSpy.mock.callCount(), 1, 'post._internalSet should be called once');
        assert.deepStrictEqual(setSpy.mock.calls[0].arguments, ['comment', serializedData], 'post._internalSet should be called with property name and serialized data');
    });

    it('EmbedMany getter should return BaseModelCollection with embedded models', async () => {
        @model
        class TestPost extends BaseModel {
            @embed(TestComment, { cardinality: 'many' })
            accessor comments!: EmbedMany<TestComment>;
        }

        const post = new TestPost();
        const commentsData = [
            { content: 'First comment' },
            { content: 'Second comment' }
        ];
        post.set('comments', commentsData);

        const result = await post.comments();

        // Should return a BaseModelCollection
        assert(result.constructor.name === 'BaseModelCollection', 'Should return BaseModelCollection instance');
        
        // Convert to array to check the hydrated models
        const modelsArray = await result.toArray();
        assert.strictEqual(modelsArray.length, 2, 'Should have 2 hydrated models');
        
        // Verify the models are actual TestComment instances (not just plain objects)
        assert(modelsArray[0] instanceof TestComment, 'First model should be TestComment instance');
        assert(modelsArray[1] instanceof TestComment, 'Second model should be TestComment instance');
        
        // Verify the models are hydrated with the correct data
        assert.strictEqual(modelsArray[0].get('content'), 'First comment', 'First model should have correct data');
        assert.strictEqual(modelsArray[1].get('content'), 'Second comment', 'Second model should have correct data');
        
        // Verify we can also iterate the collection directly to check hydrated instances
        const iteratedModels = [];
        for await (const model of result) {
            assert(model instanceof TestComment, 'Iterated model should be TestComment instance');
            iteratedModels.push(model);
        }
        assert.strictEqual(iteratedModels.length, 2, 'Should iterate over 2 models');
    });

    it('EmbedMany setter should call post.set() with serialized comments array', async () => {
        @model
        class TestPost extends BaseModel {
            @embed(TestComment, { cardinality: 'many' })
            accessor comments!: EmbedMany<TestComment>;
        }

        const post = new TestPost();
        const setSpy = mock.method(post as any, '_internalSet');
        
        const comment1 = new TestComment();
        const comment2 = new TestComment();
        const serializedData1 = { content: 'First serialized comment' };
        const serializedData2 = { content: 'Second serialized comment' };
        
        // Mock the serialize methods to return known data
        const serializeSpy1 = mock.method(comment1, 'serialize', () => serializedData1);
        const serializeSpy2 = mock.method(comment2, 'serialize', () => serializedData2);

        await post.comments([comment1, comment2]);

        assert.strictEqual(serializeSpy1.mock.callCount(), 1, 'comment1.serialize should be called once');
        assert.strictEqual(serializeSpy2.mock.callCount(), 1, 'comment2.serialize should be called once');
        assert.strictEqual(setSpy.mock.callCount(), 1, 'post._internalSet should be called once');
        assert.deepStrictEqual(setSpy.mock.calls[0].arguments, ['comments', [serializedData1, serializedData2]], 'post._internalSet should be called with property name and serialized data array');
    });

    it('should support Thunk for model constructor to break circular dependencies', () => {
        @model
        class TestPost extends BaseModel {
            @embed(thunk(() => TestComment), { cardinality: 'one' })
            accessor comment!: EmbedOne<TestComment>;

            @embed(thunk(() => TestComment), { cardinality: 'many' })
            accessor comments!: EmbedMany<TestComment>;
        }

        const post = new TestPost();
        assert(typeof post.comment === 'function', 'One embed with Thunk should create function accessor');
        assert(typeof post.comments === 'function', 'Many embed with Thunk should create function accessor');
    });
});
