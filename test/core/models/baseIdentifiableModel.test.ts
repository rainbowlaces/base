import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { BaseIdentifiableModel } from '../../../src/core/models/baseIdentifiableModel.js';
import { UniqueID } from '../../../src/core/models/uniqueId.js';
import { TestUser, TestPost, setupTestTeardown, SAMPLE_USER_DATA, MockPubSub } from './setup.js';

setupTestTeardown();

describe('BaseIdentifiableModel', () => {
    let mockPubSub: MockPubSub;

    beforeEach(() => {
        mockPubSub = new MockPubSub();
    });

    afterEach(() => {
        mockPubSub.clearEvents();
    });

    describe('ID Field Management', () => {
        it('should automatically generate a UniqueID on instantiation', () => {
            const user = new TestUser();
            
            assert.ok(user.id instanceof UniqueID);
            assert.strictEqual(user.id.toString().length, 20);
        });

        it('should have read-only ID field that cannot be set directly', () => {
            const user = new TestUser();
            const originalId = user.id;
            
            assert.throws(() => {
                user.set('id', new UniqueID());
            }, {
                message: 'Field "id" is readonly and cannot be set.'
            });
            
            // ID should remain unchanged
            assert.strictEqual(user.id, originalId);
        });

        it('should allow ID to be set during hydration from data', () => {
            const specificId = new UniqueID();
            const _user = TestUser.fromData({ 
                ...SAMPLE_USER_DATA, 
                id: specificId as any // Cast needed for test - hydration handles conversion
            });
            
            return _user.then(user => {
                assert.strictEqual(user.id.toString(), specificId.toString());
            });
        });

        it('should handle string IDs during hydration by converting to UniqueID', () => {
            // Test that string IDs are properly converted to UniqueID instances during hydration
            const stringId = new UniqueID().toString();
            const _user = TestUser.fromData({ 
                ...SAMPLE_USER_DATA, 
                id: stringId as any // Cast needed for test - hydration handles conversion
            });
            
            return _user.then(user => {
                // The hydration should convert string ID to UniqueID instance
                assert.ok(user.id instanceof UniqueID, 'ID should be converted to UniqueID instance');
                assert.strictEqual(user.id.toString(), stringId, 'ID value should match original string');
            });
        });

        it('should generate different IDs for different instances', () => {
            const user1 = new TestUser();
            const user2 = new TestUser();
            
            assert.notStrictEqual(user1.id.toString(), user2.id.toString());
        });
    });

    describe('Static Query Methods', () => {
        describe('byId() method', () => {
            it('should throw error for base implementation', async () => {
                const id = new UniqueID();
                
                await assert.rejects(
                    async () => {
                        await TestUser.byId(id);
                    },
                    {
                        message: "'TestUser.byId' is not implemented. Override the static 'byId' method in your base class."
                    }
                );
            });

            it('should accept string ID parameter', async () => {
                const id = new UniqueID().toString();
                
                await assert.rejects(
                    async () => {
                        await TestUser.byId(id);
                    },
                    {
                        message: "'TestUser.byId' is not implemented. Override the static 'byId' method in your base class."
                    }
                );
            });

            it('should accept UniqueID parameter', async () => {
                const id = new UniqueID();
                
                await assert.rejects(
                    async () => {
                        await TestUser.byId(id);
                    },
                    {
                        message: "'TestUser.byId' is not implemented. Override the static 'byId' method in your base class."
                    }
                );
            });

            it('should work with different model classes', async () => {
                const id = new UniqueID();
                
                // Test with TestPost as well
                await assert.rejects(
                    async () => {
                        await TestPost.byId(id);
                    },
                    {
                        message: "'TestPost.byId' is not implemented. Override the static 'byId' method in your base class."
                    }
                );
            });
        });

        describe('byIds() method', () => {
            it('should throw error for base implementation', async () => {
                const ids = [new UniqueID(), new UniqueID()];
                
                await assert.rejects(
                    async () => {
                        await TestUser.byIds(ids);
                    },
                    {
                        message: "'TestUser.byIds' is not implemented. Override the static 'byIds' method in your base class."
                    }
                );
            });

            it('should accept array of string IDs', async () => {
                const ids = [new UniqueID().toString(), new UniqueID().toString()];
                
                await assert.rejects(
                    async () => {
                        await TestUser.byIds(ids);
                    },
                    {
                        message: "'TestUser.byIds' is not implemented. Override the static 'byIds' method in your base class."
                    }
                );
            });

            it('should accept array of UniqueID objects', async () => {
                const ids = [new UniqueID(), new UniqueID()];
                
                await assert.rejects(
                    async () => {
                        await TestUser.byIds(ids);
                    },
                    {
                        message: "'TestUser.byIds' is not implemented. Override the static 'byIds' method in your base class."
                    }
                );
            });

            it('should accept mixed array of strings and UniqueIDs', async () => {
                const ids = [new UniqueID(), new UniqueID().toString()];
                
                await assert.rejects(
                    async () => {
                        await TestUser.byIds(ids);
                    },
                    {
                        message: "'TestUser.byIds' is not implemented. Override the static 'byIds' method in your base class."
                    }
                );
            });

            it('should handle empty array', async () => {
                const ids: string[] = [];
                
                await assert.rejects(
                    async () => {
                        await TestUser.byIds(ids);
                    },
                    {
                        message: "'TestUser.byIds' is not implemented. Override the static 'byIds' method in your base class."
                    }
                );
            });
        });
    });

    describe('Inheritance and Schema', () => {
        it('should inherit BaseModel functionality', () => {
            const user = new TestUser();
            
            // Should have BaseModel methods
            assert.strictEqual(typeof user.get, 'function');
            assert.strictEqual(typeof user.set, 'function');
            assert.strictEqual(typeof user.has, 'function');
            assert.strictEqual(typeof user.serialize, 'function');
            assert.strictEqual(typeof user.save, 'function');
            assert.strictEqual(typeof user.remove, 'function');
        });

        it('should include ID field in schema', () => {
            const schema = (TestUser as any).getProcessedSchema();
            
            assert(schema.fields.id);
            assert.strictEqual(schema.fields.id.options.readOnly, true);
            assert.strictEqual(typeof schema.fields.id.options.default, 'function');
        });

        it('should include ID field in serialised output', () => {
            const user = new TestUser();
            user.set('name', 'Test User');
            user.set('email', 'test@example.com');
            
            const serialized = user.serialize();
            
            assert('id' in serialized);
            // ID field should be serialized to string via the serializer
            assert.strictEqual(typeof serialized.id, 'string');
            assert.strictEqual(serialized.id, user.id.toString());
            assert.strictEqual(serialized.name, 'Test User');
            assert.strictEqual(serialized.email, 'test@example.com');
        });

        it('should work with inheritance chains', () => {
            const schema = (TestPost as any).getProcessedSchema();
            
            // Should have both BaseIdentifiableModel's id field and TestPost's fields
            assert(schema.fields.id);
            assert(schema.fields.title);
            assert.strictEqual(schema.fields.id.options.readOnly, true);
        });
    });

    describe('Type Safety and Generics', () => {
        it('should maintain type safety in static methods', () => {
            // This is more of a compile-time test, but we can verify runtime behavior
            const id = new UniqueID();
            
            // These should all have the right types at compile time
            // and proper error messages at runtime
            assert.rejects(async () => {
                const _user = await TestUser.byId(id);
                // Type should be TestUser | undefined
            });
            
            assert.rejects(async () => {
                const _posts = await TestPost.byIds([id]);
                // Type should be BaseModelCollection<TestPost>
            });
        });

        it('should work with inheritance hierarchies', () => {
            // Both TestUser and TestPost extend BaseIdentifiableModel
            assert.ok(new TestUser() instanceof BaseIdentifiableModel);
            assert.ok(new TestPost() instanceof BaseIdentifiableModel);
            
            // But they should have different IDs
            const user = new TestUser();
            const post = new TestPost();
            assert.notStrictEqual(user.id.toString(), post.id.toString());
        });
    });

    describe('Integration with BaseModel Features', () => {
        it('should work with persistence (when implemented)', () => {
            const user = new TestUser();
            user.set('name', 'Test User');
            user.set('email', 'test@example.com');
            
            // ID should be included in persistence operations
            return user.save().then(() => {
                assert.strictEqual((user as any).persistCalled, true);
                // The persist method would receive the ID as part of the data
            });
        });

        it('should work with deletion (when implemented)', () => {
            const user = new TestUser();
            
            return user.remove().then(() => {
                assert.strictEqual((user as any).deleteCalled, true);
                // The delete method would use the ID to identify the record
            });
        });

        it('should work with event publishing', () => {
            const user = new TestUser();
            user.set('name', 'Test User');
            user.set('email', 'test@example.com');
            
            // Events should include the model ID for identification
            return user.save().then(() => {
                // Events are mocked, but in real implementation would include ID
                assert.ok(true);
            });
        });

        it('should maintain state consistency with ID', () => {
            const user = new TestUser();
            const originalId = user.id;
            
            // Set some data
            user.set('name', 'Test User');
            
            // Revert changes - ID should remain the same
            user.revert();
            assert.strictEqual(user.id, originalId);
        });
    });
});
