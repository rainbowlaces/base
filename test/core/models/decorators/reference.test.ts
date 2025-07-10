import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../../src/core/models/baseModel';
import { reference } from '../../../../src/core/models/decorators/reference';
import { model } from '../../../../src/core/models/decorators/model';
import { type RefOne, type RefMany } from '../../../../src/core/models/types';
import { setupTestTeardown, TestUser } from '../setup';
// import { spy } from '../../../testUtils/utils';
// import { UniqueID } from '../../../../src/core/models/uniqueId';

// Setup test isolation
setupTestTeardown();

describe('@reference decorator', () => {
    it('should create function-like accessor', () => {
        @model
        class TestPost extends BaseModel {
            @reference(TestUser, { cardinality: 'one' })
            accessor author!: RefOne<TestUser>;
        }

        const post = new TestPost();
        assert(typeof post.author === 'function', 'Should create function accessor');
    });

    it('should handle one and many cardinality', () => {
        @model
        class TestPost extends BaseModel {
            @reference(TestUser, { cardinality: 'one' })
            accessor author!: RefOne<TestUser>;

            @reference(TestUser, { cardinality: 'many' })
            accessor contributors!: RefMany<TestUser>;
        }

        const post = new TestPost();
        assert(typeof post.author === 'function', 'One reference should be function');
        assert(typeof post.contributors === 'function', 'Many reference should be function');
    });

    it('should apply field options', () => {
        @model
        class TestPost extends BaseModel {
            @reference(TestUser, { 
                cardinality: 'one', 
                readOnly: true 
            })
            accessor author!: RefOne<TestUser>;
        }

        const post = new TestPost();
        assert(typeof post.author === 'function', 'Should create accessor with options');
    });

    it('should throw on direct assignment', () => {
        @model
        class TestPost extends BaseModel {
            @reference(TestUser, { cardinality: 'one' })
            accessor author!: RefOne<TestUser>;
        }

        const post = new TestPost();
        assert.throws(() => {
            (post as any).author = 'invalid';
        }, 'Should prevent direct assignment');
    });

    it('should have proper property descriptor', () => {
        @model
        class TestPost extends BaseModel {
            @reference(TestUser, { cardinality: 'one' })
            accessor author!: RefOne<TestUser>;
        }

        const descriptor = Object.getOwnPropertyDescriptor(TestPost.prototype, 'author');
        assert(descriptor, 'Should have property descriptor');
        assert(typeof descriptor.get === 'function', 'Should have getter');
        assert(typeof descriptor.set === 'function', 'Should have setter');
    });

    // it('RefOne should call OtherModel.byId() correctly', async () => {
    //     const byIdSpy = spy(TestUser, 'byId');

    //     @model
    //     class TestPost extends BaseModel {
    //         @reference(TestUser, { cardinality: 'one' })
    //         accessor author!: RefOne<TestUser>;
    //     }

    //     const post = new TestPost();
    //     const userId = new UniqueID();
    //     post.set('author', userId);

    //     await post.author();

    //     assert.strictEqual(byIdSpy.callCount(), 1, 'TestUser.byId should be called once');
    //     assert.deepStrictEqual(byIdSpy.getCall(0).arguments, [userId], 'TestUser.byId should be called with the correct id');
    // });
});
