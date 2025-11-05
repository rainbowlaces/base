import { describe, it, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../../src/core/models/baseModel.js';
import { referenceMany } from '../../../../src/core/models/decorators/referenceMany.js';
import { model } from '../../../../src/core/models/decorators/model.js';
import { type RefMany } from '../../../../src/core/models/types.js';
import { setupTestTeardown, TestUser } from '../setup.js';
import { UniqueID } from '../../../../src/core/models/uniqueId.js';
import { thunk } from '../../../../src/utils/thunk.js';

// Setup test isolation
setupTestTeardown();

describe('@referenceMany decorator', () => {
    it('should create function-like accessor', () => {
        @model
        class TestPost extends BaseModel {
            @referenceMany(TestUser)
            accessor contributors!: RefMany<TestUser>;
        }

        const post = new TestPost();
        assert(typeof post.contributors === 'function', 'Should create function accessor');
    });

    it('should apply field options', () => {
        @model
        class TestPost extends BaseModel {
            @referenceMany(TestUser, {
                readOnly: true 
            })
            accessor contributors!: RefMany<TestUser>;
        }

        const post = new TestPost();
        assert(typeof post.contributors === 'function', 'Should create accessor with options');
    });

    it('should throw on direct assignment', () => {
        @model
        class TestPost extends BaseModel {
            @referenceMany(TestUser)
            accessor contributors!: RefMany<TestUser>;
        }

        const post = new TestPost();
        assert.throws(() => {
            (post as any).contributors = 'invalid';
        }, 'Should prevent direct assignment');
    });

    it('should have proper property descriptor', () => {
        @model
        class TestPost extends BaseModel {
            @referenceMany(TestUser)
            accessor contributors!: RefMany<TestUser>;
        }

        const descriptor = Object.getOwnPropertyDescriptor(TestPost.prototype, 'contributors');
        assert(descriptor, 'Should have property descriptor');
        assert(typeof descriptor.get === 'function', 'Should have getter');
        assert(typeof descriptor.set === 'function', 'Should have setter');
    });

    it('should work with default values', () => {
        @model
        class TestPost extends BaseModel {
            @referenceMany(TestUser, {
                default: () => []
            })
            accessor contributors!: RefMany<TestUser>;
        }

        const post = new TestPost();
        assert(typeof post.contributors === 'function', 'Should create accessor with default');
    });

    it('getter should call model.byIds() correctly', async () => {
        // Mock the byIds method to return mock users instead of throwing
        const mockUser1 = new TestUser();
        const mockUser2 = new TestUser();
        const byIdsSpy = mock.method(TestUser, 'byIds', () => Promise.resolve([mockUser1, mockUser2]));

        @model
        class TestPost extends BaseModel {
            @referenceMany(TestUser)
            accessor contributors!: RefMany<TestUser>;
        }

        const post = new TestPost();
        const userId1 = new UniqueID();
        const userId2 = new UniqueID();
        post.set('contributors', [userId1, userId2]);

        const result = await post.contributors();

        assert.strictEqual(byIdsSpy.mock.callCount(), 1, 'TestUser.byIds should be called once');
        assert.deepStrictEqual(byIdsSpy.mock.calls[0].arguments, [[userId1, userId2]], 'TestUser.byIds should be called with the correct IDs array');
        assert.deepStrictEqual(result, [mockUser1, mockUser2], 'Should return the users from byIds');
    });

    it('setter should call post.set() with user IDs array', async () => {
        // Mock the byIds method to prevent the "not implemented" error when it returns the empty collection
        const mockCollection: any = {};
        mock.method(TestUser, 'byIds', () => Promise.resolve(mockCollection));

        @model
        class TestPost extends BaseModel {
            @referenceMany(TestUser)
            accessor contributors!: RefMany<TestUser>;
        }

        const post = new TestPost();
        const setSpy = mock.method(post as any, '_internalSet');
        const user1 = new TestUser();
        const user2 = new TestUser();

        await post.contributors([user1, user2]);

        assert.strictEqual(setSpy.mock.callCount(), 1, 'post._internalSet should be called once');
        assert.deepStrictEqual(setSpy.mock.calls[0].arguments, ['contributors', [user1.id, user2.id]], 'post._internalSet should be called with property name and user IDs array');
    });

    it('setter should handle mixed ID/model array conversion', async () => {
        // Mock the byIds method to prevent the "not implemented" error when it returns the empty collection
        const mockCollection: any = {};
        mock.method(TestUser, 'byIds', () => Promise.resolve(mockCollection));

        @model
        class TestPost extends BaseModel {
            @referenceMany(TestUser)
            accessor contributors!: RefMany<TestUser>;
        }

        const post = new TestPost();
        const setSpy = mock.method(post as any, '_internalSet');
        const user = new TestUser();
        const userId = new UniqueID();

        // Pass mixed array: both model instance and raw ID
        await post.contributors([user, userId]);

        assert.strictEqual(setSpy.mock.callCount(), 1, 'post._internalSet should be called once');
        assert.deepStrictEqual(setSpy.mock.calls[0].arguments, ['contributors', [user.id, userId]], 'post._internalSet should be called with array of IDs (both model.id and raw ID)');
    });

    it('should integrate with field metadata system', () => {
        @model
        class TestPost extends BaseModel {
            @referenceMany(TestUser, {
                readOnly: true
            })
            accessor contributors!: RefMany<TestUser>;
        }

        const schema = (TestPost as typeof BaseModel).getProcessedSchema();
        
        // Should have reference field in the schema
        assert(schema.fields.contributors, 'Should have contributors field in schema');
        
        // Should preserve field options
        assert.strictEqual(schema.fields.contributors.options.readOnly, true, 'Should preserve readOnly option');
        
        // Should have relation metadata
        assert(schema.fields.contributors.relation, 'Should have relation metadata for contributors');
        
        assert.strictEqual(schema.fields.contributors.relation.type, 'reference', 'Should be reference type');
        assert.strictEqual(schema.fields.contributors.relation.cardinality, 'many', 'Should have many cardinality');
        
        // Should reference the correct model
        assert.strictEqual(schema.fields.contributors.relation.model, TestUser, 'Should reference TestUser model');
    });

    it('should support Thunk for model constructor to break circular dependencies', () => {
        @model
        class TestPost extends BaseModel {
            @referenceMany(thunk(() => TestUser))
            accessor contributors!: RefMany<TestUser>;
        }

        const post = new TestPost();
        assert(typeof post.contributors === 'function', 'ReferenceMany with Thunk should create function accessor');
    });
});
