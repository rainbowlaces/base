import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../../src/core/models/baseModel';
import { embed } from '../../../../src/core/models/decorators/embed';
import { model } from '../../../../src/core/models/decorators/model';
import { type EmbedOne, type EmbedMany } from '../../../../src/core/models/types';
import { setupTestTeardown, TestComment } from '../setup';

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
});
