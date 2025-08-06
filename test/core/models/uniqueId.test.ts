import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UniqueID } from '../../../src/core/models/uniqueId.js';
import { setupTestTeardown } from './setup.js';

setupTestTeardown();

describe('UniqueID', () => {
    describe('Construction and Validation', () => {
        it('should generate a valid, 24-character ID when called with no arguments', () => {
            const id = new UniqueID();
            
            assert.strictEqual(id.toString().length, 24);
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
                new UniqueID('ABC123XYZ789!@#$%^&*1234'); // 24 chars with invalid characters
            }, /Invalid UniqueID format.*invalid characters/);
        });

        it('should handle hash-based ID string in constructor', () => {
            const hashId = 'z123456789abcdef12345678'; // Valid hash-based format
            const id = new UniqueID(hashId);
            
            assert.strictEqual(id.toString(), hashId);
            assert.strictEqual(id.getType(), 'HASH_BASED');
        });

        it('should handle time-based ID string in constructor', () => {
            const timeId = '123456789abcdef123456789'; // Valid time-based format (no 'z' prefix)
            const id = new UniqueID(timeId);
            
            assert.strictEqual(id.toString(), timeId);
            assert.strictEqual(id.getType(), 'TIME_BASED');
        });
    });

    describe('Date Constructor', () => {
        it('should create UniqueID from Date object with correct timestamp', () => {
            const testDate = new Date('2024-01-01T00:00:00Z');
            const id = new UniqueID(testDate);
            
            assert.strictEqual(id.toString().length, 24);
            assert.match(id.toString(), /^[0-9a-z]+$/);
            assert.strictEqual(id.getTimestamp().getTime(), testDate.getTime());
        });

        it('should create different IDs for same date (different random parts)', () => {
            const testDate = new Date('2024-06-15T10:30:00Z');
            const id1 = new UniqueID(testDate);
            const id2 = new UniqueID(testDate);
            
            // Same timestamp part, different random parts
            assert.strictEqual(id1.getTimestamp().getTime(), id2.getTimestamp().getTime());
            assert.notStrictEqual(id1.toString(), id2.toString());
        });

        it('should accept any valid date (including ancient dates)', () => {
            const ancientDate = new Date('1999-12-31T23:59:59Z');
            const id = new UniqueID(ancientDate);
            
            assert.strictEqual(id.getTimestamp().getTime(), ancientDate.getTime());
        });

        it('should accept any valid date (including future dates)', () => {
            const futureDate = new Date(Date.now() + (2 * 365 * 24 * 60 * 60 * 1000)); // 2 years from now
            const id = new UniqueID(futureDate);
            
            assert.strictEqual(id.getTimestamp().getTime(), futureDate.getTime());
        });

        it('should accept current date', () => {
            const now = new Date();
            const id = new UniqueID(now);
            
            assert.strictEqual(id.getTimestamp().getTime(), now.getTime());
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
            const testId = timestampStr + '123456789012345'; // 15 random chars
            
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
            assert.strictEqual(str.length, 24);
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

    describe('UniqueID.from() Static Method', () => {
        it('should create hash-based ID from string input', () => {
            const testString = 'hello world';
            const id = UniqueID.from(testString);
            
            assert.strictEqual(id.toString().length, 24);
            assert.match(id.toString(), /^z[0-9a-z]+$/); // Should start with 'z'
            assert.strictEqual(id.getType(), 'HASH_BASED');
        });

        it('should create deterministic IDs (same string = same ID)', () => {
            const testString = 'test-string-for-deterministic-hash';
            const id1 = UniqueID.from(testString);
            const id2 = UniqueID.from(testString);
            
            assert.strictEqual(id1.toString(), id2.toString());
            assert.ok(id1.equals(id2));
        });

        it('should create different IDs for different strings', () => {
            const id1 = UniqueID.from('string-one');
            const id2 = UniqueID.from('string-two');
            
            assert.notStrictEqual(id1.toString(), id2.toString());
            assert.ok(!id1.equals(id2));
        });

        it('should create time-based ID from Date input', () => {
            const testDate = new Date('2024-06-15T10:30:00Z');
            const id = UniqueID.from(testDate);
            
            assert.strictEqual(id.toString().length, 24);
            assert.match(id.toString(), /^[0-9a-z]+$/);
            assert.ok(!id.toString().startsWith('z')); // Should NOT start with 'z'
            assert.strictEqual(id.getType(), 'TIME_BASED');
            assert.strictEqual(id.getTimestamp().getTime(), testDate.getTime());
        });

        it('should handle empty string input', () => {
            const id = UniqueID.from('');
            
            assert.strictEqual(id.toString().length, 24);
            assert.match(id.toString(), /^z[0-9a-z]+$/);
            assert.strictEqual(id.getType(), 'HASH_BASED');
        });

        it('should handle very long string input', () => {
            const longString = 'a'.repeat(1000);
            const id = UniqueID.from(longString);
            
            assert.strictEqual(id.toString().length, 24);
            assert.match(id.toString(), /^z[0-9a-z]+$/);
            assert.strictEqual(id.getType(), 'HASH_BASED');
        });

        it('should handle special characters in string input', () => {
            const specialString = '!@#$%^&*()_+-=[]{}|;:,.<>?';
            const id = UniqueID.from(specialString);
            
            assert.strictEqual(id.toString().length, 24);
            assert.match(id.toString(), /^z[0-9a-z]+$/);
            assert.strictEqual(id.getType(), 'HASH_BASED');
        });

        it('should handle Unicode strings', () => {
            const unicodeString = '🚀 Hello 世界 🌟';
            const id = UniqueID.from(unicodeString);
            
            assert.strictEqual(id.toString().length, 24);
            assert.match(id.toString(), /^z[0-9a-z]+$/);
            assert.strictEqual(id.getType(), 'HASH_BASED');
        });
    });

    describe('ID Type Detection', () => {
        it('should return HASH_BASED for hash-based IDs', () => {
            const hashId = UniqueID.from('test-string');
            assert.strictEqual(hashId.getType(), 'HASH_BASED');
        });

        it('should return TIME_BASED for time-based IDs', () => {
            const timeId = new UniqueID();
            assert.strictEqual(timeId.getType(), 'TIME_BASED');
            
            const dateId = new UniqueID(new Date());
            assert.strictEqual(dateId.getType(), 'TIME_BASED');
        });

        it('should correctly identify type when constructed from string', () => {
            // Create a hash ID and reconstruct it
            const originalHash = UniqueID.from('test');
            const reconstructedHash = new UniqueID(originalHash.toString());
            assert.strictEqual(reconstructedHash.getType(), 'HASH_BASED');

            // Create a time ID and reconstruct it
            const originalTime = new UniqueID();
            const reconstructedTime = new UniqueID(originalTime.toString());
            assert.strictEqual(reconstructedTime.getType(), 'TIME_BASED');
        });
    });

    describe('Hash-based ID Restrictions', () => {
        it('should throw error when calling getTimestamp() on hash-based ID', () => {
            const hashId = UniqueID.from('test-string');
            
            assert.throws(() => {
                hashId.getTimestamp();
            }, /Cannot get timestamp from a hash-based UniqueID/);
        });

        it('should allow getTimestamp() on time-based IDs', () => {
            const timeId = new UniqueID();
            const timestamp = timeId.getTimestamp();
            
            assert.ok(timestamp instanceof Date);
            assert.ok(!isNaN(timestamp.getTime()));
        });
    });

    describe('Hash-based ID Integration', () => {
        it('should serialize hash-based IDs correctly', () => {
            const hashId = UniqueID.from('test-serialization');
            
            assert.strictEqual(hashId.toJSON(), hashId.toString());
            assert.strictEqual(hashId.serialize(), hashId.toString());
            
            const jsonString = JSON.stringify({ id: hashId });
            const parsed = JSON.parse(jsonString);
            assert.strictEqual(parsed.id, hashId.toString());
        });

        it('should support equality comparison between same hash IDs', () => {
            const id1 = UniqueID.from('same-input');
            const id2 = UniqueID.from('same-input');
            
            assert.ok(id1.equals(id2));
            assert.ok(id1.equals(id2.toString()));
        });

        it('should support equality comparison between different types', () => {
            const hashId = UniqueID.from('test');
            const timeId = new UniqueID();
            
            assert.ok(!hashId.equals(timeId));
            assert.ok(!timeId.equals(hashId));
        });

        it('should copy hash-based IDs correctly', () => {
            const originalHash = UniqueID.from('copy-test');
            const copiedHash = new UniqueID(originalHash);
            
            assert.strictEqual(copiedHash.toString(), originalHash.toString());
            assert.strictEqual(copiedHash.getType(), 'HASH_BASED');
            assert.notStrictEqual(copiedHash, originalHash); // Different instances
        });

        it('should validate hash-based IDs correctly', () => {
            const hashId = UniqueID.from('validation-test');
            const hashIdString = hashId.toString();
            
            assert.ok(UniqueID.isValid(hashIdString));
            assert.ok(UniqueID.isValid(hashIdString, true)); // With throws = true
        });
    });
});
