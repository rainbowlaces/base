import { describe, it } from 'node:test';
import assert from 'node:assert';
import { toUniqueId, toUniqueIdAsync, toUniqueIds } from '../../../src/core/models/utils.js';
import { UniqueID } from '../../../src/core/models/uniqueId.js';
import { TestUser, setupTestTeardown, SAMPLE_USER_DATA } from './setup.js';

setupTestTeardown();

describe('Model Utils', () => {
    describe('toUniqueId', () => {
        it('should correctly convert a string to UniqueID', () => {
            const testString = new UniqueID().toString();
            const result = toUniqueId(testString);
            
            assert.ok(result instanceof UniqueID);
            assert.strictEqual(result.toString(), testString);
        });

        it('should correctly pass through a UniqueID instance', () => {
            const original = new UniqueID();
            const result = toUniqueId(original);
            
            assert.strictEqual(result, original);
        });

        it('should correctly extract ID from BaseIdentifiableModel instance', async () => {
            const user = await TestUser.fromData(SAMPLE_USER_DATA);
            const result = toUniqueId(user);
            
            assert.ok(result instanceof UniqueID);
            assert.strictEqual(result.toString(), user.id.toString());
        });

        it('should throw an error for invalid input types', () => {
            assert.throws(() => {
                toUniqueId(123 as any);
            }, /Invalid id type.*Expected Identifiable object, UniqueID, or string/);

            assert.throws(() => {
                toUniqueId(null as any);
            }, /Invalid id type.*Expected Identifiable object, UniqueID, or string/);

            assert.throws(() => {
                toUniqueId({} as any);
            }, /Invalid id type.*Expected Identifiable object, UniqueID, or string/);
        });
    });

    describe('toUniqueIdAsync', () => {
        it('should correctly resolve and convert a Promise<string>', async () => {
            const testString = new UniqueID().toString();
            const promiseString = Promise.resolve(testString);
            
            const result = await toUniqueIdAsync(promiseString);
            
            assert.ok(result instanceof UniqueID);
            assert.strictEqual(result.toString(), testString);
        });

        it('should correctly resolve and convert a Promise<UniqueID>', async () => {
            const original = new UniqueID();
            const promiseId = Promise.resolve(original);
            
            const result = await toUniqueIdAsync(promiseId);
            
            assert.strictEqual(result, original);
        });

        it('should correctly resolve and convert a Promise<BaseIdentifiableModel>', async () => {
            const user = await TestUser.fromData(SAMPLE_USER_DATA);
            const promiseUser = Promise.resolve(user);
            
            const result = await toUniqueIdAsync(promiseUser);
            
            assert.ok(result instanceof UniqueID);
            assert.strictEqual(result.toString(), user.id.toString());
        });

        it('should handle non-promise values (sync case)', async () => {
            const testString = new UniqueID().toString();
            
            const result = await toUniqueIdAsync(testString);
            
            assert.ok(result instanceof UniqueID);
            assert.strictEqual(result.toString(), testString);
        });
    });

    describe('toUniqueIds', () => {
        it('should correctly convert an array of strings', () => {
            const testStrings = [new UniqueID().toString(), new UniqueID().toString()];
            const result = toUniqueIds(testStrings);
            
            assert.strictEqual(result.length, 2);
            assert.ok(result.every(id => id instanceof UniqueID));
            assert.strictEqual(result[0].toString(), testStrings[0]);
            assert.strictEqual(result[1].toString(), testStrings[1]);
        });

        it('should correctly convert a mixed array of strings, UniqueIDs, and models', async () => {
            const user1 = await TestUser.fromData(SAMPLE_USER_DATA);
            const user2 = await TestUser.fromData({ ...SAMPLE_USER_DATA, id: new UniqueID() });
            const uniqueId = new UniqueID();
            const stringId = new UniqueID().toString();
            
            const mixed = [user1, uniqueId, stringId, user2];
            const result = toUniqueIds(mixed);
            
            assert.strictEqual(result.length, 4);
            assert.ok(result.every(id => id instanceof UniqueID));
            assert.strictEqual(result[0].toString(), user1.id.toString());
            assert.strictEqual(result[1], uniqueId);
            assert.strictEqual(result[2].toString(), stringId);
            assert.strictEqual(result[3].toString(), user2.id.toString());
        });

        it('should handle empty arrays', () => {
            const result = toUniqueIds([]);
            assert.strictEqual(result.length, 0);
            assert.ok(Array.isArray(result));
        });
    });
});
