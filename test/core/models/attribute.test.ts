import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { Attribute } from '../../../src/core/models/attributable/attribute.js';
import { UniqueID } from '../../../src/core/models/uniqueId.js';
import { setupTestTeardown } from './setup.js';

// Setup test isolation
setupTestTeardown();

describe('Attribute Model', () => {
    describe('Creation and Basic Properties', () => {
        it('should create attribute with string value', async () => {
            const attr = await Attribute.create({
                name: 'testName',
                value: 'testValue',
                created: new Date()
            });

            assert.equal(attr.name, 'testName');
            assert.equal(attr.value, 'testValue');
            assert.ok(attr.created instanceof Date);
        });

        it('should create attribute with number value', async () => {
            const attr = await Attribute.create({
                name: 'count',
                value: 42,
                created: new Date()
            });

            assert.equal(attr.name, 'count');
            assert.equal(attr.value, 42);
            assert.equal(typeof attr.value, 'number');
        });

        it('should create attribute with boolean value', async () => {
            const attr = await Attribute.create({
                name: 'isActive',
                value: true,
                created: new Date()
            });

            assert.equal(attr.name, 'isActive');
            assert.equal(attr.value, true);
            assert.equal(typeof attr.value, 'boolean');
        });

        it('should create attribute with Date value', async () => {
            const testDate = new Date('2025-07-22T10:00:00Z');
            const attr = await Attribute.create({
                name: 'eventDate',
                value: testDate,
                created: new Date()
            });

            assert.equal(attr.name, 'eventDate');
            assert.ok(attr.value instanceof Date);
            assert.equal((attr.value).getTime(), testDate.getTime());
        });

        it('should create attribute with UniqueID value', async () => {
            const testId = new UniqueID();
            const attr = await Attribute.create({
                name: 'relatedId',
                value: testId,
                created: new Date()
            });

            assert.equal(attr.name, 'relatedId');
            assert.ok(attr.value instanceof UniqueID);
            assert.ok((attr.value).equals(testId));
        });

        it('should auto-create timestamp if not provided', async () => {
            const beforeCreation = new Date();
            const attr = await Attribute.create({
                name: 'test',
                value: 'value'
            });
            const afterCreation = new Date();

            assert.ok(attr.created instanceof Date);
            assert.ok(attr.created.getTime() >= beforeCreation.getTime());
            assert.ok(attr.created.getTime() <= afterCreation.getTime());
        });
    });

    describe('Serialization and Hydration', () => {
        it('should serialize UniqueID to string', async () => {
            const testId = new UniqueID();
            const attr = await Attribute.create({
                name: 'testId',
                value: testId,
                created: new Date()
            });

            // Access the serialized data (this would happen during persistence)
            const data = attr.serialize();
            assert.equal(typeof data.value, 'string');
            assert.equal(data.value, testId.toString());
        });

        it('should serialize Date to ISO string', async () => {
            const testDate = new Date('2025-07-22T10:00:00.123Z');
            const attr = await Attribute.create({
                name: 'testDate',
                value: testDate,
                created: new Date()
            });

            const data = attr.serialize();
            assert.equal(typeof data.value, 'string');
            assert.equal(data.value, testDate.toISOString());
        });

        it('should hydrate string back to UniqueID', async () => {
            const originalId = new UniqueID();
            const idString = originalId.toString();

            // Simulate loading from persistence
            const attr = await Attribute.fromData({
                name: 'testId',
                value: idString,
                created: new Date()
            });

            assert.ok(attr.value instanceof UniqueID);
            assert.ok((attr.value).equals(originalId));
        });

        it('should hydrate ISO string back to Date', async () => {
            const originalDate = new Date('2025-07-22T10:00:00.123Z');
            const dateString = originalDate.toISOString();

            const attr = await Attribute.fromData({
                name: 'testDate',
                value: dateString,
                created: new Date()
            });

            assert.ok(attr.value instanceof Date);
            assert.equal((attr.value).getTime(), originalDate.getTime());
        });

        it('should preserve primitive values during serialization/hydration', async () => {
            const primitives = [
                { name: 'string', value: 'test string' },
                { name: 'number', value: 42 },
                { name: 'boolean', value: true },
                { name: 'zero', value: 0 },
                { name: 'false', value: false },
                { name: 'empty', value: '' }
            ];

            for (const { name, value } of primitives) {
                const attr = await Attribute.create({
                    name,
                    value,
                    created: new Date()
                });

                const data = attr.serialize();
                const hydrated = await Attribute.fromData(data);

                assert.equal(hydrated.value, value);
                assert.equal(typeof hydrated.value, typeof value);
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle string that looks like UniqueID but fails validation', async () => {
            // Create a 20-character string that's not a valid UniqueID
            const invalidIdString = 'a'.repeat(20);

            const attr = await Attribute.fromData({
                name: 'testId',
                value: invalidIdString,
                created: new Date()
            });

            // Should remain as string since UniqueID creation failed
            assert.equal(typeof attr.value, 'string');
            assert.equal(attr.value, invalidIdString);
        });

        it('should handle string that looks like Date but isn\'t', async () => {
            const nonDateString = 'not-a-date-2025-01-01';

            const attr = await Attribute.fromData({
                name: 'testString',
                value: nonDateString,
                created: new Date()
            });

            // Should remain as string
            assert.equal(typeof attr.value, 'string');
            assert.equal(attr.value, nonDateString);
        });

        it('should handle partial date strings', async () => {
            const partialDateString = '2025-01-01T';

            const attr = await Attribute.fromData({
                name: 'testString',
                value: partialDateString,
                created: new Date()
            });

            // Should remain as string since it doesn't fully match date pattern
            assert.equal(typeof attr.value, 'string');
            assert.equal(attr.value, partialDateString);
        });
    });

    describe('Model Schema Integration', () => {
        it('should have proper field definitions', async () => {
            const attr = await Attribute.create({
                name: 'test',
                value: 'value',
                created: new Date()
            });

            // Verify that the fields are accessible
            assert.ok(typeof attr.name === 'string');
            assert.ok(attr.value !== undefined);
            assert.ok(attr.created instanceof Date);
        });

        it('should support model operations', async () => {
            const attr = await Attribute.create({
                name: 'test',
                value: 'value',
                created: new Date()
            });

            // Test basic model operations
            const data = attr.serialize();
            assert.ok(data.name);
            assert.ok(data.value);
            assert.ok(data.created);

            const cloned = await Attribute.fromData(data);
            assert.equal(cloned.name, attr.name);
            assert.equal(cloned.value, attr.value);
        });
    });
});
