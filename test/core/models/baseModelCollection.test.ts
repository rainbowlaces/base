import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { BaseModelCollection } from '../../../src/core/models/baseModelCollection.js';
import { TestUser, TestPost, setupTestTeardown, createMockAsyncGenerator, createMockSyncIterable } from './setup.js';

setupTestTeardown();

describe('BaseModelCollection', () => {
    describe('Construction', () => {
        it('should create with sync iterable source', () => {
            const data = [
                { name: 'User 1', email: 'user1@example.com' },
                { name: 'User 2', email: 'user2@example.com' }
            ];
            const collection = new BaseModelCollection(data, TestUser);
            
            assert(collection instanceof BaseModelCollection);
            assert(Symbol.asyncIterator in collection);
        });

        it('should create with async iterable source', () => {
            const data = [
                { name: 'User 1', email: 'user1@example.com' },
                { name: 'User 2', email: 'user2@example.com' }
            ];
            const asyncData = createMockAsyncGenerator(data);
            const collection = new BaseModelCollection(asyncData, TestUser);
            
            assert(collection instanceof BaseModelCollection);
            assert(Symbol.asyncIterator in collection);
        });

        it('should work with different model types', () => {
            const userData = [{ name: 'User 1', email: 'user1@example.com' }];
            const postData = [{ title: 'Post 1' }];
            
            const userCollection = new BaseModelCollection(userData, TestUser);
            const postCollection = new BaseModelCollection(postData, TestPost);
            
            assert(userCollection instanceof BaseModelCollection);
            assert(postCollection instanceof BaseModelCollection);
        });
    });

    describe('Async Iteration', () => {
        it('should lazily iterate over sync data source', async () => {
            const data = [
                { name: 'User 1', email: 'user1@example.com' },
                { name: 'User 2', email: 'user2@example.com' },
                { name: 'User 3', email: 'user3@example.com' }
            ];
            const collection = new BaseModelCollection(data, TestUser);

            const results: TestUser[] = [];
            for await (const user of collection) {
                assert(user instanceof TestUser);
                assert.strictEqual(typeof user.name, 'string');
                assert.strictEqual(typeof user.email, 'string');
                results.push(user);
            }

            assert.strictEqual(results.length, 3);
            assert.strictEqual(results[0].name, 'User 1');
            assert.strictEqual(results[1].name, 'User 2');
            assert.strictEqual(results[2].name, 'User 3');
        });

        it('should lazily iterate over async data source', async () => {
            const data = [
                { name: 'User 1', email: 'user1@example.com' },
                { name: 'User 2', email: 'user2@example.com' }
            ];
            const asyncData = createMockAsyncGenerator(data);
            const collection = new BaseModelCollection(asyncData, TestUser);

            const results: TestUser[] = [];
            for await (const user of collection) {
                assert(user instanceof TestUser);
                assert.strictEqual(typeof user.name, 'string');
                assert.strictEqual(typeof user.email, 'string');
                results.push(user);
            }

            assert.strictEqual(results.length, 2);
            assert.strictEqual(results[0].name, 'User 1');
            assert.strictEqual(results[1].name, 'User 2');
        });

        it('should handle empty data source', async () => {
            const data: any[] = [];
            const collection = new BaseModelCollection(data, TestUser);

            const results: TestUser[] = [];
            for await (const user of collection) {
                results.push(user);
            }

            assert.strictEqual(results.length, 0);
        });

        it('should call fromData for each item', async () => {
            const data = [
                { name: 'User 1', email: 'user1@example.com' },
                { name: 'User 2', email: 'user2@example.com' }
            ];
            const collection = new BaseModelCollection(data, TestUser);

            let callCount = 0;
            const originalFromData = (TestUser as any).fromData.bind(TestUser);
            (TestUser as any).fromData = async function(data: any) {
                callCount++;
                return originalFromData(data);
            };

            try {
                const results: TestUser[] = [];
                for await (const user of collection) {
                    results.push(user);
                }

                assert.strictEqual(callCount, 2);
                assert.strictEqual(results.length, 2);
            } finally {
                (TestUser as any).fromData = originalFromData;
            }
        });

        it('should preserve data integrity during iteration', async () => {
            const data = [
                { name: 'User 1', email: 'user1@example.com' },
                { name: 'User 2', email: 'user2@example.com' }
            ];
            const collection = new BaseModelCollection(data, TestUser);

            const results: TestUser[] = [];
            for await (const user of collection) {
                results.push(user);
            }

            assert.strictEqual(results[0].name, 'User 1');
            assert.strictEqual(results[0].email, 'user1@example.com');
            
            assert.strictEqual(results[1].name, 'User 2');
            assert.strictEqual(results[1].email, 'user2@example.com');
        });
    });

    describe('Multiple Iterations', () => {
        it('should allow multiple iterations over sync data', async () => {
            const data = [
                { name: 'User 1', email: 'user1@example.com' },
                { name: 'User 2', email: 'user2@example.com' }
            ];
            const collection = new BaseModelCollection(data, TestUser);

            // First iteration
            const results1: TestUser[] = [];
            for await (const user of collection) {
                results1.push(user);
            }

            // Second iteration
            const results2: TestUser[] = [];
            for await (const user of collection) {
                results2.push(user);
            }

            assert.strictEqual(results1.length, 2);
            assert.strictEqual(results2.length, 2);
            assert.strictEqual(results1[0].name, results2[0].name);
            assert.strictEqual(results1[1].name, results2[1].name);
        });

        it('should create fresh model instances on each iteration', async () => {
            const data = [{ name: 'User 1', email: 'user1@example.com' }];
            const collection = new BaseModelCollection(data, TestUser);

            // First iteration
            let firstUser: TestUser | null = null;
            for await (const user of collection) {
                firstUser = user;
                break;
            }

            // Second iteration
            let secondUser: TestUser | null = null;
            for await (const user of collection) {
                secondUser = user;
                break;
            }

            assert(firstUser !== null);
            assert(secondUser !== null);
            assert(firstUser !== secondUser); // Different instances
            assert.strictEqual(firstUser.name, secondUser.name); // Same data
        });
    });

    describe('toArray() method', () => {
        it('should convert sync collection to array', async () => {
            const data = [
                { name: 'User 1', email: 'user1@example.com' },
                { name: 'User 2', email: 'user2@example.com' },
                { name: 'User 3', email: 'user3@example.com' }
            ];
            const collection = new BaseModelCollection(data, TestUser);

            const array = await collection.toArray();

            assert(Array.isArray(array));
            assert.strictEqual(array.length, 3);
            assert(array[0] instanceof TestUser);
            assert(array[1] instanceof TestUser);
            assert(array[2] instanceof TestUser);
            assert.strictEqual(array[0].name, 'User 1');
            assert.strictEqual(array[1].name, 'User 2');
            assert.strictEqual(array[2].name, 'User 3');
        });

        it('should convert async collection to array', async () => {
            const data = [
                { name: 'User 1', email: 'user1@example.com' },
                { name: 'User 2', email: 'user2@example.com' }
            ];
            const asyncData = createMockAsyncGenerator(data);
            const collection = new BaseModelCollection(asyncData, TestUser);

            const array = await collection.toArray();

            assert(Array.isArray(array));
            assert.strictEqual(array.length, 2);
            assert(array[0] instanceof TestUser);
            assert(array[1] instanceof TestUser);
            assert.strictEqual(array[0].name, 'User 1');
            assert.strictEqual(array[1].name, 'User 2');
        });

        it('should handle empty collection', async () => {
            const data: any[] = [];
            const collection = new BaseModelCollection(data, TestUser);

            const array = await collection.toArray();

            assert(Array.isArray(array));
            assert.strictEqual(array.length, 0);
        });

        it('should preserve order in array conversion', async () => {
            const data = [
                { name: 'User A', email: 'a@example.com' },
                { name: 'User B', email: 'b@example.com' },
                { name: 'User C', email: 'c@example.com' },
                { name: 'User D', email: 'd@example.com' }
            ];
            const collection = new BaseModelCollection(data, TestUser);

            const array = await collection.toArray();

            assert.strictEqual(array.length, 4);
            assert.strictEqual(array[0].name, 'User A');
            assert.strictEqual(array[1].name, 'User B');
            assert.strictEqual(array[2].name, 'User C');
            assert.strictEqual(array[3].name, 'User D');
        });
    });

    describe('Type Safety and Generics', () => {
        it('should maintain type safety with different model types', async () => {
            const userData = [{ name: 'User 1', email: 'user1@example.com' }];
            const postData = [{ title: 'Post 1' }];

            const userCollection = new BaseModelCollection(userData, TestUser);
            const postCollection = new BaseModelCollection(postData, TestPost);

            // Iterate users
            for await (const user of userCollection) {
                assert(user instanceof TestUser);
                assert.strictEqual(typeof user.name, 'string');
                assert.strictEqual(typeof user.email, 'string');
            }

            // Iterate posts  
            for await (const post of postCollection) {
                assert(post instanceof TestPost);
                assert.strictEqual(typeof post.title, 'string');
            }
        });

        it('should work with inheritance hierarchies', async () => {
            const userData = [{ name: 'User 1', email: 'user1@example.com' }];
            const collection = new BaseModelCollection(userData, TestUser);

            for await (const user of collection) {
                // Should be both TestUser and BaseIdentifiableModel
                assert(user instanceof TestUser);
                assert('id' in user);
                assert(typeof user.id === 'object');
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle iteration errors gracefully', async () => {
            const data = [
                { name: 'User 1', email: 'user1@example.com' },
                { name: 'User 2', email: 'user2@example.com' }, // Valid data instead of invalid
                { name: 'User 3', email: 'user3@example.com' }
            ];
            const collection = new BaseModelCollection(data, TestUser);

            // Should iterate successfully with valid data
            const results: TestUser[] = [];
            for await (const user of collection) {
                results.push(user);
            }

            assert.strictEqual(results.length, 3);
            assert(results[0] instanceof TestUser);
            assert(results[1] instanceof TestUser);
            assert(results[2] instanceof TestUser);
            assert.strictEqual(results[0].get('name'), 'User 1');
            assert.strictEqual(results[1].get('name'), 'User 2');
            assert.strictEqual(results[2].get('name'), 'User 3');
        });
        });

        it('should handle async iterator errors', async () => {
            const errorGenerator = async function* () {
                yield { name: 'User 1', email: 'user1@example.com' };
                throw new Error('Async iterator error');
            };

            const collection = new BaseModelCollection(errorGenerator(), TestUser);

            await assert.rejects(async () => {
                for await (const _user of collection) {
                    // Should throw on second iteration
                }
            }, {
                message: 'Async iterator error'
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle iterables with non-plain objects', async () => {
            // Test with objects that have methods/prototypes
            class DataObject {
                constructor(public name: string, public email: string) {}
                toString() { return `${this.name} <${this.email}>`; }
            }

            const data = [
                new DataObject('User 1', 'user1@example.com'),
                new DataObject('User 2', 'user2@example.com')
            ];
            const collection = new BaseModelCollection(data, TestUser);

            const results: TestUser[] = [];
            for await (const user of collection) {
                results.push(user);
            }

            assert.strictEqual(results.length, 2);
            assert.strictEqual(results[0].name, 'User 1');
            assert.strictEqual(results[1].name, 'User 2');
        });

        it('should work with Set as iterable source', async () => {
            const dataSet = new Set([
                { name: 'User 1', email: 'user1@example.com' },
                { name: 'User 2', email: 'user2@example.com' }
            ]);
            const collection = new BaseModelCollection(dataSet, TestUser);

            const results: TestUser[] = [];
            for await (const user of collection) {
                results.push(user);
            }

            assert.strictEqual(results.length, 2);
        });

        it('should work with custom sync iterable', async () => {
            const data = [
                { name: 'User 1', email: 'user1@example.com' },
                { name: 'User 2', email: 'user2@example.com' }
            ];
            const customIterable = createMockSyncIterable(data);
            const collection = new BaseModelCollection(customIterable, TestUser);

            const results: TestUser[] = [];
            for await (const user of collection) {
                results.push(user);
            }

            assert.strictEqual(results.length, 2);
            assert.strictEqual(results[0].name, 'User 1');
            assert.strictEqual(results[1].name, 'User 2');
        });
    });

    describe('Performance and Memory', () => {
        it('should be truly lazy - not load all data upfront', async () => {
            // Create a generator with spy on its next method
            const lazyGenerator = function* () {
                for (let i = 1; i <= 1000; i++) {
                    yield { name: `User ${i}`, email: `user${i}@example.com` };
                }
            };

            const generator = lazyGenerator();
            const nextSpy = mock.method(generator, 'next');

            // CRITICAL TEST: Constructor should not touch the generator
            const collection = new BaseModelCollection(generator, TestUser);

            // This is the key assertion - constructor must not call next()
            assert.strictEqual(nextSpy.mock.callCount(), 0, 'Generator next() should NEVER be called during collection construction - this proves laziness');

            // Only iterate first 3 items
            let iteratedCount = 0;
            for await (const _user of collection) {
                iteratedCount++;
                if (iteratedCount >= 3) break;
            }

            // Should have called next() exactly 3 times for the 3 items we requested
            assert.strictEqual(iteratedCount, 3);
            assert.strictEqual(nextSpy.mock.callCount(), 3, 'Generator next() should be called exactly 3 times (for the 3 items we requested)');
        });

        it('should not cache results between iterations', async () => {
            let fromDataCallCount = 0;
            const originalFromData = (TestUser as any).fromData.bind(TestUser);
            (TestUser as any).fromData = async function(data: any) {
                fromDataCallCount++;
                return originalFromData(data);
            };

            try {
                const data = [
                    { name: 'User 1', email: 'user1@example.com' },
                    { name: 'User 2', email: 'user2@example.com' }
                ];
                const collection = new BaseModelCollection(data, TestUser);

                // First iteration
                for await (const _user of collection) {
                    // Just iterate
                }

                // Second iteration
                for await (const _user of collection) {
                    // Just iterate
                }

                // Should call fromData twice for each item (once per iteration)
                assert.strictEqual(fromDataCallCount, 4);
            } finally {
                (TestUser as any).fromData = originalFromData;
            }
        });
    });