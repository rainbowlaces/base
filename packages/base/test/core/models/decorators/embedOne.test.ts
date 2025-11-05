import { describe, it, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../../src/core/models/baseModel.js';
import { embedOne } from '../../../../src/core/models/decorators/embedOne.js';
import { model } from '../../../../src/core/models/decorators/model.js';
import { type EmbedOne } from '../../../../src/core/models/types.js';
import { setupTestTeardown, TestComment } from '../setup.js';
import { thunk } from '../../../../src/utils/thunk.js';

// Setup test isolation
setupTestTeardown();

describe('@embedOne decorator', () => {
    it('should create function-like accessor for embedded model', () => {
        @model
        class TestPost extends BaseModel {
            @embedOne(TestComment)
            accessor comment!: EmbedOne<TestComment>;
        }

        const post = new TestPost();
        assert(typeof post.comment === 'function', 'Should create function accessor');
    });

    it('should apply field options', () => {
        @model
        class TestPost extends BaseModel {
            @embedOne(TestComment, { 
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
            @embedOne(TestComment)
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
            @embedOne(TestComment)
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
            @embedOne(TestComment, {
                default: () => ({ content: 'Default comment' } as any)
            })
            accessor comment!: EmbedOne<TestComment>;
        }

        const post = new TestPost();
        assert(typeof post.comment === 'function', 'Should create accessor with default');
    });

    it('should call model.fromData() correctly', async () => {
        // Mock the fromData method to return a mock comment instead of throwing
        const mockComment = new TestComment();
        const fromDataSpy = mock.method(TestComment, 'fromData', () => Promise.resolve(mockComment));

        @model
        class TestPost extends BaseModel {
            @embedOne(TestComment)
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

    it('setter should call post.set() with serialized comment data', async () => {
        @model
        class TestPost extends BaseModel {
            @embedOne(TestComment)
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

    it('should support Thunk for model constructor to break circular dependencies', () => {
        @model
        class TestPost extends BaseModel {
            @embedOne(thunk(() => TestComment))
            accessor comment!: EmbedOne<TestComment>;
        }

        const post = new TestPost();
        assert(typeof post.comment === 'function', 'EmbedOne with Thunk should create function accessor');
    });
});
