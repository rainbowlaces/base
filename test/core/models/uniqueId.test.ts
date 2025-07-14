import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UniqueID } from '../../../src/core/models/uniqueId.js';
import { setupTestTeardown } from './setup.js';

setupTestTeardown();

describe('UniqueID', () => {
    describe('Construction and Validation', () => {
        it('should generate a valid, 20-character ID when called with no arguments', () => {
            const id = new UniqueID();
            
            assert.strictEqual(id.toString().length, 20);
            assert.match(id.toString(), /^[0-9a-z]+$/);
        });

        it('should correctly store and return a pre-existing valid ID', () => {
            const originalId = new UniqueID();
            const originalStr = originalId.toString();
            
            const copyId = new UniqueID(originalStr);
            assert.strictEqual(copyId.toString(), originalStr);
        });

        it('should correctly copy from another UniqueID instance', () => {
            const originalId = new UniqueID();
            const copyId = new UniqueID(originalId);
            
            assert.strictEqual(copyId.toString(), originalId.toString());
            assert.notStrictEqual(copyId, originalId); // Different instances
        });

        it('should throw an error for an invalid ID (wrong length)', () => {
            assert.throws(() => {
                new UniqueID('tooshort');
            }, /Invalid UniqueID length/);

            assert.throws(() => {
                new UniqueID('thisistoolongforauniqueidentifier');
            }, /Invalid UniqueID length/);
        });

        it('should throw an error for an invalid ID (invalid characters)', () => {
            assert.throws(() => {
                new UniqueID('abc123XYZ789!@#$%^&*');
            }, /Invalid UniqueID format.*invalid characters/);
        });

        it('should throw an error for invalid timestamp part', () => {
            // Create an ID with invalid timestamp characters
            assert.throws(() => {
                new UniqueID('zzzzzzzzz12345678901');
            }, /Invalid UniqueID.*timestamp/);
        });

        it('should throw an error for unreasonable timestamp', () => {
            // Test with a timestamp that's too old (before year 2000)
            const oldTimestamp = '0'.repeat(9);
            assert.throws(() => {
                new UniqueID(oldTimestamp + '12345678901');
            }, /Invalid UniqueID.*timestamp.*outside reasonable range/);
        });
    });

    describe('Timestamp Operations', () => {
        it('should correctly parse the timestamp from a valid ID', () => {
            const beforeCreation = Date.now();
            const id = new UniqueID();
            const afterCreation = Date.now();
            
            const timestamp = id.getTimestamp();
            
            assert.ok(timestamp.getTime() >= beforeCreation);
            assert.ok(timestamp.getTime() <= afterCreation);
        });

        it('should parse timestamp from a provided ID string', () => {
            const testDate = new Date('2023-06-15T10:30:00Z');
            const timestampStr = testDate.getTime().toString(36).padStart(9, '0');
            const testId = timestampStr + '12345678901';
            
            const id = new UniqueID(testId);
            const parsedDate = id.getTimestamp();
            
            assert.strictEqual(parsedDate.getTime(), testDate.getTime());
        });
    });

    describe('Comparison and Equality', () => {
        it('should correctly compare two IDs with .equals()', () => {
            const id1 = new UniqueID();
            const id2 = new UniqueID(id1.toString());
            const id3 = new UniqueID();
            
            assert.ok(id1.equals(id2));
            assert.ok(id1.equals(id1.toString()));
            assert.ok(!id1.equals(id3));
            assert.ok(!id1.equals(id3.toString()));
        });

        it('should handle string comparison in equals', () => {
            const id = new UniqueID();
            const idString = id.toString();
            
            assert.ok(id.equals(idString));
            assert.ok(!id.equals('different-string'));
        });
    });

    describe('Serialization', () => {
        it('should correctly serialize to a string via .toString()', () => {
            const id = new UniqueID();
            const str = id.toString();
            
            assert.strictEqual(typeof str, 'string');
            assert.strictEqual(str.length, 20);
            assert.match(str, /^[0-9a-z]+$/);
        });

        it('should correctly serialize to JSON via .toJSON()', () => {
            const id = new UniqueID();
            const json = id.toJSON();
            
            assert.strictEqual(json, id.toString());
            assert.strictEqual(JSON.stringify({ id }), `{"id":"${id.toString()}"}`);
        });
    });

    describe('Uniqueness and Ordering', () => {
        it('should generate unique IDs when called multiple times', () => {
            const ids = new Set();
            for (let i = 0; i < 100; i++) {
                ids.add(new UniqueID().toString());
            }
            
            assert.strictEqual(ids.size, 100);
        });

        it('should generate IDs in roughly chronological order', () => {
            const id1 = new UniqueID();
            // Small delay to ensure different timestamps
            const id2 = new UniqueID();
            
            const timestamp1 = id1.getTimestamp().getTime();
            const timestamp2 = id2.getTimestamp().getTime();
            
            assert.ok(timestamp2 >= timestamp1);
        });
    });
});
