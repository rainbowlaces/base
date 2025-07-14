import { describe, it, mock } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../../src/core/models/baseModel.js';
import { reference } from '../../../../src/core/models/decorators/reference.js';
import { model } from '../../../../src/core/models/decorators/model.js';
import { type RefOne, type RefMany } from '../../../../src/core/models/types.js';
import { setupTestTeardown, TestUser } from '../setup.js';
import { UniqueID } from '../../../../src/core/models/uniqueId.js';
import { thunk } from '../../../../src/utils/thunk.js';

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

    it('RefOne should call OtherModel.byId() correctly', async () => {
        // Mock the byId method to return a mock user instead of throwing
        const mockUser = new TestUser();
        const byIdSpy = mock.method(TestUser, 'byId', () => Promise.resolve(mockUser));

        @model
        class TestPost extends BaseModel {
            @reference(TestUser, { cardinality: 'one' })
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

    it('RefOne setter should call post.set() with user UniqueID', async () => {
        @model
        class TestPost extends BaseModel {
            @reference(TestUser, { cardinality: 'one' })
            accessor author!: RefOne<TestUser>;
        }

        const post = new TestPost();
        const setSpy = mock.method(post, 'set');
        const user = new TestUser();

        await post.author(user);

        assert.strictEqual(setSpy.mock.callCount(), 1, 'post.set should be called once');
        assert.deepStrictEqual(setSpy.mock.calls[0].arguments, ['author', user.id], 'post.set should be called with property name and user ID');
    });

    it('RefMany getter should call TestUser.byIds() correctly', async () => {
        // Mock the byIds method to return mock users instead of throwing
        const mockUser1 = new TestUser();
        const mockUser2 = new TestUser();
        const byIdsSpy = mock.method(TestUser, 'byIds', () => Promise.resolve([mockUser1, mockUser2]));

        @model
        class TestPost extends BaseModel {
            @reference(TestUser, { cardinality: 'many' })
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

    it('RefMany setter should call post.set() with user IDs array', async () => {
        // Mock the byIds method to prevent the "not implemented" error when it returns the empty collection
        const mockCollection: any = {};
        mock.method(TestUser, 'byIds', () => Promise.resolve(mockCollection));

        @model
        class TestPost extends BaseModel {
            @reference(TestUser, { cardinality: 'many' })
            accessor contributors!: RefMany<TestUser>;
        }

        const post = new TestPost();
        const setSpy = mock.method(post, 'set');
        const user1 = new TestUser();
        const user2 = new TestUser();

        await post.contributors([user1, user2]);

        assert.strictEqual(setSpy.mock.callCount(), 1, 'post.set should be called once');
        assert.deepStrictEqual(setSpy.mock.calls[0].arguments, ['contributors', [user1.id, user2.id]], 'post.set should be called with property name and user IDs array');
    });

    it('RefMany setter should handle mixed ID/model array conversion', async () => {
        // Mock the byIds method to prevent the "not implemented" error when it returns the empty collection
        const mockCollection: any = {};
        mock.method(TestUser, 'byIds', () => Promise.resolve(mockCollection));

        @model
        class TestPost extends BaseModel {
            @reference(TestUser, { cardinality: 'many' })
            accessor contributors!: RefMany<TestUser>;
        }

        const post = new TestPost();
        const setSpy = mock.method(post, 'set');
        const user = new TestUser();
        const userId = new UniqueID();

        // Pass mixed array: both model instance and raw ID
        await post.contributors([user, userId]);

        assert.strictEqual(setSpy.mock.callCount(), 1, 'post.set should be called once');
        assert.deepStrictEqual(setSpy.mock.calls[0].arguments, ['contributors', [user.id, userId]], 'post.set should be called with array of IDs (both model.id and raw ID)');
    });

    it('should handle error when reference model byId() fails', async () => {
        // Mock byId to throw an error
        const byIdSpy = mock.method(TestUser, 'byId', () => Promise.reject(new Error('User not found')));

        @model
        class TestPost extends BaseModel {
            @reference(TestUser, { cardinality: 'one' })
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

    it('RefOne should handle when byId() returns undefined', async () => {
        // Mock byId to return undefined (user not found)
        const byIdSpy = mock.method(TestUser, 'byId', () => Promise.resolve(undefined));

        @model
        class TestPost extends BaseModel {
            @reference(TestUser, { cardinality: 'one' })
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

    it('RefOne should handle when stored ID is undefined', async () => {
        @model
        class TestPost extends BaseModel {
            @reference(TestUser, { cardinality: 'one' })
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
            @reference(TestUser, { 
                cardinality: 'one',
                readOnly: true
            })
            accessor author!: RefOne<TestUser>;

            @reference(TestUser, { 
                cardinality: 'many'
            })
            accessor contributors!: RefMany<TestUser>;
        }

        const schema = (TestPost as typeof BaseModel).getProcessedSchema();
        
        // Should have reference fields in the schema
        assert(schema.fields.author, 'Should have author field in schema');
        assert(schema.fields.contributors, 'Should have contributors field in schema');
        
        // Should preserve field options
        assert.strictEqual(schema.fields.author.options.readOnly, true, 'Should preserve readOnly option');
        
        // Should have relation metadata
        assert(schema.fields.author.relation, 'Should have relation metadata for author');
        assert(schema.fields.contributors.relation, 'Should have relation metadata for contributors');
        
        assert.strictEqual(schema.fields.author.relation.type, 'reference', 'Should be reference type');
        assert.strictEqual(schema.fields.author.relation.cardinality, 'one', 'Should have one cardinality');
        assert.strictEqual(schema.fields.contributors.relation.cardinality, 'many', 'Should have many cardinality');
        
        // Should reference the correct model
        assert.strictEqual(schema.fields.author.relation.model, TestUser, 'Should reference TestUser model');
        assert.strictEqual(schema.fields.contributors.relation.model, TestUser, 'Should reference TestUser model');
    });

    it('should support Thunk for model constructor to break circular dependencies', () => {
        @model
        class TestPost extends BaseModel {
            @reference(thunk(() => TestUser), { cardinality: 'one' })
            accessor author!: RefOne<TestUser>;

            @reference(thunk(() => TestUser), { cardinality: 'many' })
            accessor contributors!: RefMany<TestUser>;
        }

        const post = new TestPost();
        assert(typeof post.author === 'function', 'One reference with Thunk should create function accessor');
        assert(typeof post.contributors === 'function', 'Many reference with Thunk should create function accessor');
    });
});
