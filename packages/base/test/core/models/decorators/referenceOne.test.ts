import { describe, it, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../../src/core/models/baseModel.js';
import { referenceOne } from '../../../../src/core/models/decorators/referenceOne.js';
import { model } from '../../../../src/core/models/decorators/model.js';
import { type RefOne } from '../../../../src/core/models/types.js';
import { setupTestTeardown, TestUser } from '../setup.js';
import { UniqueID } from '../../../../src/core/models/uniqueId.js';
import { thunk } from '../../../../src/utils/thunk.js';

// Setup test isolation
setupTestTeardown();

describe('@referenceOne decorator', () => {
    it('should create function-like accessor', () => {
        @model
        class TestPost extends BaseModel {
            @referenceOne(TestUser)
            accessor author!: RefOne<TestUser>;
        }

        const post = new TestPost();
        assert(typeof post.author === 'function', 'Should create function accessor');
    });

    it('should apply field options', () => {
        @model
        class TestPost extends BaseModel {
            @referenceOne(TestUser, {
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
            @referenceOne(TestUser)
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
            @referenceOne(TestUser)
            accessor author!: RefOne<TestUser>;
        }

        const descriptor = Object.getOwnPropertyDescriptor(TestPost.prototype, 'author');
        assert(descriptor, 'Should have property descriptor');
        assert(typeof descriptor.get === 'function', 'Should have getter');
        assert(typeof descriptor.set === 'function', 'Should have setter');
    });

    it('should call model.byId() correctly', async () => {
        // Mock the byId method to return a mock user instead of throwing
        const mockUser = new TestUser();
        const byIdSpy = mock.method(TestUser, 'byId', () => Promise.resolve(mockUser));

        @model
        class TestPost extends BaseModel {
            @referenceOne(TestUser)
            accessor author!: RefOne<TestUser>;
        }

        const post = new TestPost();
        const userId = new UniqueID();
        post.set('author', userId);

        const result = await post.author();

        assert.strictEqual(byIdSpy.mock.callCount(), 1, 'TestUser.byId should be called once');
        assert.deepStrictEqual(byIdSpy.mock.calls[0].arguments, [userId], 'TestUser.byId should be called with the correct id');
        assert.strictEqual(result, mockUser, 'Should return the user from byId');
    });

    it('setter should call post.set() with user UniqueID', async () => {
        @model
        class TestPost extends BaseModel {
            @referenceOne(TestUser)
            accessor author!: RefOne<TestUser>;
        }

        const post = new TestPost();
        const setSpy = mock.method(post as any, '_internalSet');
        const user = new TestUser();

        await post.author(user);

        assert.strictEqual(setSpy.mock.callCount(), 1, 'post._internalSet should be called once');
        assert.deepStrictEqual(setSpy.mock.calls[0].arguments, ['author', user.id], 'post._internalSet should be called with property name and user ID');
    });

    it('should handle error when reference model byId() fails', async () => {
        // Mock byId to throw an error
        const byIdSpy = mock.method(TestUser, 'byId', () => Promise.reject(new Error('User not found')));

        @model
        class TestPost extends BaseModel {
            @referenceOne(TestUser)
            accessor author!: RefOne<TestUser>;
        }

        const post = new TestPost();
        const userId = new UniqueID();
        post.set('author', userId);

        // Should propagate the error from byId
        await assert.rejects(
            () => post.author(),
            (err: Error) => err.message === 'User not found'
        );

        assert.strictEqual(byIdSpy.mock.callCount(), 1, 'TestUser.byId should be called once');
    });

    it('should handle when byId() returns undefined', async () => {
        // Mock byId to return undefined (user not found)
        const byIdSpy = mock.method(TestUser, 'byId', () => Promise.resolve(undefined));

        @model
        class TestPost extends BaseModel {
            @referenceOne(TestUser)
            accessor author!: RefOne<TestUser>;
        }

        const post = new TestPost();
        const userId = new UniqueID();
        post.set('author', userId);

        const result = await post.author();

        assert.strictEqual(byIdSpy.mock.callCount(), 1, 'TestUser.byId should be called once');
        assert.deepStrictEqual(byIdSpy.mock.calls[0].arguments, [userId], 'TestUser.byId should be called with the correct id');
        assert.strictEqual(result, undefined, 'Should return undefined when user is not found');
    });

    it('should handle when stored ID is undefined', async () => {
        @model
        class TestPost extends BaseModel {
            @referenceOne(TestUser)
            accessor author!: RefOne<TestUser>;
        }

        const post = new TestPost();
        // Don't set any author ID - should be undefined
        
        const result = await post.author();
        
        assert.strictEqual(result, undefined, 'Should return undefined when no ID is set');
    });

    it('should integrate with field metadata system', () => {
        @model
        class TestPost extends BaseModel {
            @referenceOne(TestUser, {
                readOnly: true
            })
            accessor author!: RefOne<TestUser>;
        }

        const schema = (TestPost as typeof BaseModel).getProcessedSchema();
        
        // Should have reference field in the schema
        assert(schema.fields.author, 'Should have author field in schema');
        
        // Should preserve field options
        assert.strictEqual(schema.fields.author.options.readOnly, true, 'Should preserve readOnly option');
        
        // Should have relation metadata
        assert(schema.fields.author.relation, 'Should have relation metadata for author');
        
        assert.strictEqual(schema.fields.author.relation.type, 'reference', 'Should be reference type');
        assert.strictEqual(schema.fields.author.relation.cardinality, 'one', 'Should have one cardinality');
        
        // Should reference the correct model
        assert.strictEqual(schema.fields.author.relation.model, TestUser, 'Should reference TestUser model');
    });

    it('should support Thunk for model constructor to break circular dependencies', () => {
        @model
        class TestPost extends BaseModel {
            @referenceOne(thunk(() => TestUser))
            accessor author!: RefOne<TestUser>;
        }

        const post = new TestPost();
        assert(typeof post.author === 'function', 'ReferenceOne with Thunk should create function accessor');
    });
});
