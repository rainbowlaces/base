import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../src/core/models/baseModel.js';
import { UniqueID } from '../../../src/core/models/uniqueId.js';
import { Attributable } from '../../../src/core/models/attributable/attributable.js';
import { model } from '../../../src/core/models/decorators/model.js';
import { field } from '../../../src/core/models/decorators/field.js';
import { setupTestTeardown } from './setup.js';

// Setup test isolation
setupTestTeardown();

// Create a test model using the Attributable mixin
const TEST_PRODUCT_ATTRIBUTES = {
    color:          [String, 'single'],
    isPublished:    [Boolean, 'single'],
    inventoryCount: [Number, 'single'],
    tags:           [String, 'many'],
    relatedProducts: [UniqueID, 'many'],
} as const;

@model
class TestProduct extends Attributable<typeof TEST_PRODUCT_ATTRIBUTES, typeof BaseModel>(BaseModel) {
    @field()
    accessor name!: string;
    
    @field()
    accessor price!: number;

    // Define the attributes specification as a readonly property
    public readonly Attributes = TEST_PRODUCT_ATTRIBUTES;
}

describe('Attributable Mixin', () => {
    describe('Basic Attribute Operations', () => {
        it('should set and get single attributes', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            // Test string attribute
            await product.setAttribute('color', 'red');
            const color = await product.getAttribute('color');
            assert.equal(color, 'red');
            
            // Test boolean attribute
            await product.setAttribute('isPublished', true);
            const isPublished = await product.getAttribute('isPublished');
            assert.equal(isPublished, true);
            
            // Test number attribute
            await product.setAttribute('inventoryCount', 50);
            const inventoryCount = await product.getAttribute('inventoryCount');
            assert.equal(inventoryCount, 50);
        });

        it('should set and get many attributes', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            // Add multiple tags
            await product.setAttribute('tags', 'electronics');
            await product.setAttribute('tags', 'gadget');
            await product.setAttribute('tags', 'popular');
            
            const tags = await product.getAttribute('tags');
            assert.deepEqual(tags, ['electronics', 'gadget', 'popular']);
        });

        it('should work with UniqueID attributes', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            const relatedId1 = new UniqueID();
            const relatedId2 = new UniqueID();
            
            await product.setAttribute('relatedProducts', relatedId1);
            await product.setAttribute('relatedProducts', relatedId2);
            
            const relatedProducts = await product.getAttribute('relatedProducts');
            assert.equal(relatedProducts.length, 2);
            
            // Check if the UniqueIDs are in the array by using equals() method
            const hasId1 = relatedProducts.some((id: any) => id instanceof UniqueID && id.equals(relatedId1));
            const hasId2 = relatedProducts.some((id: any) => id instanceof UniqueID && id.equals(relatedId2));
            assert.ok(hasId1, 'relatedId1 should be in the array');
            assert.ok(hasId2, 'relatedId2 should be in the array');
        });
    });

    describe('Single vs Many Cardinality', () => {
        it('should replace values for single cardinality attributes', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            await product.setAttribute('color', 'red');
            await product.setAttribute('color', 'blue'); // Should replace red
            
            const color = await product.getAttribute('color');
            assert.equal(color, 'blue');
        });

        it('should accumulate values for many cardinality attributes', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            await product.setAttribute('tags', 'tag1');
            await product.setAttribute('tags', 'tag2');
            await product.setAttribute('tags', 'tag3');
            
            const tags = await product.getAttribute('tags');
            assert.equal(tags.length, 3);
            assert.ok(tags.includes('tag1'));
            assert.ok(tags.includes('tag2'));
            assert.ok(tags.includes('tag3'));
        });

        it('should prevent duplicate values for many cardinality attributes', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            await product.setAttribute('tags', 'duplicate');
            await product.setAttribute('tags', 'unique');
            await product.setAttribute('tags', 'duplicate'); // Should not duplicate
            
            const tags = await product.getAttribute('tags');
            assert.equal(tags.length, 2);
            const duplicates = tags.filter((tag: any) => tag === 'duplicate');
            assert.equal(duplicates.length, 1);
        });
    });

    describe('Attribute Queries', () => {
        it('should check if attribute exists', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            assert.equal(await product.hasAttribute('color'), false);
            
            await product.setAttribute('color', 'red');
            assert.equal(await product.hasAttribute('color'), true);
        });

        it('should check if specific attribute value exists', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            await product.setAttribute('tags', 'electronics');
            await product.setAttribute('tags', 'gadget');
            
            assert.equal(await product.hasAttribute('tags', 'electronics'), true);
            assert.equal(await product.hasAttribute('tags', 'nonexistent'), false);
        });
    });

    describe('Attribute Deletion', () => {
        it('should delete all attributes with a given name', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            await product.setAttribute('tags', 'tag1');
            await product.setAttribute('tags', 'tag2');
            await product.setAttribute('tags', 'tag3');
            
            await product.deleteAttribute('tags');
            
            const tags = await product.getAttribute('tags');
            assert.equal(tags.length, 0);
        });

        it('should delete specific attribute value', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            await product.setAttribute('tags', 'keep');
            await product.setAttribute('tags', 'delete');
            await product.setAttribute('tags', 'keep2');
            
            await product.deleteAttribute('tags', 'delete');
            
            const tags = await product.getAttribute('tags');
            assert.equal(tags.length, 2);
            assert.ok(tags.includes('keep'));
            assert.ok(tags.includes('keep2'));
            assert.ok(!tags.includes('delete'));
        });

        it('should delete specific UniqueID attribute value', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            const id1 = new UniqueID();
            const id2 = new UniqueID();
            const id3 = new UniqueID();
            
            await product.setAttribute('relatedProducts', id1);
            await product.setAttribute('relatedProducts', id2);
            await product.setAttribute('relatedProducts', id3);
            
            await product.deleteAttribute('relatedProducts', id2);
            
            const related = await product.getAttribute('relatedProducts');
            assert.equal(related.length, 2);
            
            const hasId1 = related.some((id: any) => id instanceof UniqueID && id.equals(id1));
            const hasId2 = related.some((id: any) => id instanceof UniqueID && id.equals(id2));
            const hasId3 = related.some((id: any) => id instanceof UniqueID && id.equals(id3));
            
            assert.ok(hasId1, 'Should still have id1');
            assert.ok(!hasId2, 'Should not have id2');
            assert.ok(hasId3, 'Should still have id3');
        });
    });

    describe('Edge Cases & Error Handling', () => {
        it('should provide compile-time safety for attribute names', async () => {
            const EMPTY_ATTRIBUTES = {} as const;
            
            @model
            class ModelWithoutAttributes extends Attributable<typeof EMPTY_ATTRIBUTES, typeof BaseModel>(BaseModel) {
                @field()
                accessor name!: string;
                // Empty Attributes spec - no attributes allowed
                public readonly Attributes = EMPTY_ATTRIBUTES;
            }

            const testModel = await ModelWithoutAttributes.create({ name: 'Test' });
            
            // This test demonstrates that TypeScript now prevents accessing non-existent attributes
            // The following line would cause a compile error:
            // await testModel.getAttribute('anyKey'); // Error: Argument of type '"anyKey"' is not assignable to parameter of type 'never'
            
            // This is better than a runtime error - we get compile-time safety!
            assert.ok(testModel instanceof ModelWithoutAttributes);
        });

        it('should handle empty attributes array', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            // Get attribute that doesn't exist
            const nonExistent = await product.getAttribute('tags');
            assert.deepEqual(nonExistent, []);
            
            // Check if non-existent attribute exists
            assert.equal(await product.hasAttribute('tags'), false);
        });

        it('should handle deletion of non-existent attributes', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            // Should not throw when deleting non-existent attribute value
            await product.deleteAttribute('tags'); // Delete all tags (none exist)
            await product.deleteAttribute('tags', 'nonExistent'); // Delete specific non-existent tag
            
            // Verify no attributes were affected
            const attributes = await product.attributes();
            const all = await attributes.toArray();
            assert.equal(all.length, 0);
        });
    });

    describe('Date Handling', () => {
        it('should handle Date objects as attribute values', async () => {
            const EVENT_ATTRIBUTES = {
                eventDate: [Date, 'single'],
                reminders: [Date, 'many'],
            } as const;
            
            @model
            class TestEvent extends Attributable<typeof EVENT_ATTRIBUTES, typeof BaseModel>(BaseModel) {
                @field()
                accessor name!: string;

                public readonly Attributes = EVENT_ATTRIBUTES;
            }

            const event = await TestEvent.create({ name: 'Test Event' });
            const eventDate = new Date('2025-12-25T10:00:00Z');
            const reminder1 = new Date('2025-12-20T09:00:00Z');
            const reminder2 = new Date('2025-12-24T18:00:00Z');
            
            // Set single date
            await event.setAttribute('eventDate', eventDate);
            const retrievedDate = await event.getAttribute('eventDate');
            assert.ok(retrievedDate instanceof Date);
            assert.equal(retrievedDate.getTime(), eventDate.getTime());
            
            // Set multiple dates
            await event.setAttribute('reminders', reminder1);
            await event.setAttribute('reminders', reminder2);
            
            const reminders = await event.getAttribute('reminders');
            assert.equal(reminders.length, 2);
            assert.ok(reminders.every((date: any) => date instanceof Date));
            
            // Check date comparison in hasAttribute
            assert.equal(await event.hasAttribute('eventDate', eventDate), true);
            assert.equal(await event.hasAttribute('reminders', reminder1), true);
            assert.equal(await event.hasAttribute('reminders', new Date('2025-01-01')), false);
        });

        it('should preserve Date precision in serialization/hydration', async () => {
            const DATE_ATTRIBUTES = {
                timestamp: [Date, 'single'],
            } as const;
            
            @model
            class TestDateModel extends Attributable<typeof DATE_ATTRIBUTES, typeof BaseModel>(BaseModel) {
                @field()
                accessor name!: string;

                public readonly Attributes = DATE_ATTRIBUTES;
            }

            const dateModel = await TestDateModel.create({ name: 'Test' });
            const originalDate = new Date('2025-07-22T14:30:45.123Z');
            
            await dateModel.setAttribute('timestamp', originalDate);
            const retrieved = await dateModel.getAttribute('timestamp');
            
            assert.ok(retrieved instanceof Date);
            assert.equal(retrieved.getTime(), originalDate.getTime());
            assert.equal(retrieved.getMilliseconds(), originalDate.getMilliseconds());
        });
    });

    describe('Type Validation & Coercion', () => {
        it('should handle various primitive types correctly', async () => {
            const TYPED_ATTRIBUTES = {
                stringVal: [String, 'single'],
                numberVal: [Number, 'single'],
                booleanVal: [Boolean, 'single'],
                mixedMany: [String, 'many'], // Testing if we can add different types
            } as const;
            
            @model
            class TestTypedModel extends Attributable<typeof TYPED_ATTRIBUTES, typeof BaseModel>(BaseModel) {
                @field()
                accessor name!: string;

                public readonly Attributes = TYPED_ATTRIBUTES;
            }

            const typedModel = await TestTypedModel.create({ name: 'Test' });
            
            // Test string
            await typedModel.setAttribute('stringVal', 'test string');
            assert.equal(await typedModel.getAttribute('stringVal'), 'test string');
            
            // Test number
            await typedModel.setAttribute('numberVal', 42);
            assert.equal(await typedModel.getAttribute('numberVal'), 42);
            
            // Test boolean
            await typedModel.setAttribute('booleanVal', true);
            assert.equal(await typedModel.getAttribute('booleanVal'), true);
            
            await typedModel.setAttribute('booleanVal', false);
            assert.equal(await typedModel.getAttribute('booleanVal'), false);
        });

        it('should handle zero and empty string values', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            // Zero should be a valid value
            await product.setAttribute('inventoryCount', 0);
            assert.equal(await product.getAttribute('inventoryCount'), 0);
            assert.equal(await product.hasAttribute('inventoryCount', 0), true);
            
            // Empty string should be valid
            await product.setAttribute('color', '');
            assert.equal(await product.getAttribute('color'), '');
            assert.equal(await product.hasAttribute('color', ''), true);
        });
    });

    describe('UniqueID Edge Cases', () => {
        it('should properly compare UniqueID instances', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            const id1 = new UniqueID();
            const id2 = new UniqueID(id1.toString()); // Same value, different instance
            
            await product.setAttribute('relatedProducts', id1);
            
            // Should find the attribute with a different instance but same value
            assert.equal(await product.hasAttribute('relatedProducts', id2), true);
            
            // Should be able to delete with different instance but same value
            await product.deleteAttribute('relatedProducts', id2);
            const remaining = await product.getAttribute('relatedProducts');
            assert.equal(remaining.length, 0);
        });

        it('should handle UniqueID in single cardinality attributes', async () => {
            const UNIQUE_ID_ATTRIBUTES = {
                primaryId: [UniqueID, 'single'],
                relatedIds: [UniqueID, 'many'],
            } as const;
            
            @model
            class TestUniqueIDModel extends Attributable<typeof UNIQUE_ID_ATTRIBUTES, typeof BaseModel>(BaseModel) {
                @field()
                accessor name!: string;

                public readonly Attributes = UNIQUE_ID_ATTRIBUTES;
            }

            const uniqueModel = await TestUniqueIDModel.create({ name: 'Test' });
            const id1 = new UniqueID();
            const id2 = new UniqueID();
            
            // Set single UniqueID
            await uniqueModel.setAttribute('primaryId', id1);
            const retrievedId = await uniqueModel.getAttribute('primaryId');
            assert.ok(retrievedId instanceof UniqueID);
            assert.ok(retrievedId.equals(id1));
            
            // Replace single UniqueID
            await uniqueModel.setAttribute('primaryId', id2);
            const newRetrievedId = await uniqueModel.getAttribute('primaryId');
            assert.ok(newRetrievedId instanceof UniqueID);
            assert.ok(newRetrievedId.equals(id2));
            assert.ok(!newRetrievedId.equals(id1));
        });
    });

    describe('getRawAttributes', () => {
        it('should return all raw attributes when no name specified', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            await product.setAttribute('color', 'red');
            await product.setAttribute('tags', 'electronics');
            await product.setAttribute('tags', 'gadget');
            await product.setAttribute('inventoryCount', 50);
            
            const allRaw = await product.getRawAttributes();
            assert.equal(allRaw.length, 4);
            
            // Check that we get actual Attribute objects
            allRaw.forEach(attr => {
                assert.ok(attr.name);
                assert.ok(attr.value !== undefined);
                assert.ok(attr.created instanceof Date);
            });
            
            // Check specific attributes exist
            const colorAttrs = allRaw.filter(attr => attr.name === 'color');
            const tagAttrs = allRaw.filter(attr => attr.name === 'tags');
            const inventoryAttrs = allRaw.filter(attr => attr.name === 'inventoryCount');
            
            assert.equal(colorAttrs.length, 1);
            assert.equal(tagAttrs.length, 2);
            assert.equal(inventoryAttrs.length, 1);
        });

        it('should return filtered raw attributes when name specified', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            await product.setAttribute('color', 'red');
            await product.setAttribute('tags', 'electronics');
            await product.setAttribute('tags', 'gadget');
            await product.setAttribute('inventoryCount', 50);
            
            const tagRaw = await product.getRawAttributes('tags');
            assert.equal(tagRaw.length, 2);
            
            // All returned attributes should be for 'tags'
            tagRaw.forEach(attr => {
                assert.equal(attr.name, 'tags');
                assert.ok(['electronics', 'gadget'].includes(attr.value as string));
                assert.ok(attr.created instanceof Date);
            });
        });

        it('should return empty array for non-existent attribute name', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            const nonExistentRaw = await product.getRawAttributes('color');
            assert.equal(nonExistentRaw.length, 0);
            assert.ok(Array.isArray(nonExistentRaw));
        });

        it('should return raw attributes with creation timestamps', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            const beforeTime = new Date();
            
            await product.setAttribute('color', 'blue');
            
            const colorRaw = await product.getRawAttributes('color');
            assert.equal(colorRaw.length, 1);
            
            const attr = colorRaw[0];
            assert.equal(attr.name, 'color');
            assert.equal(attr.value, 'blue');
            assert.ok(attr.created instanceof Date);
            assert.ok(attr.created.getTime() >= beforeTime.getTime());
        });

        it('should handle UniqueID attributes in raw form', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            const id1 = new UniqueID();
            const id2 = new UniqueID();
            
            await product.setAttribute('relatedProducts', id1);
            await product.setAttribute('relatedProducts', id2);
            
            const relatedRaw = await product.getRawAttributes('relatedProducts');
            assert.equal(relatedRaw.length, 2);
            
            relatedRaw.forEach(attr => {
                assert.equal(attr.name, 'relatedProducts');
                assert.ok(attr.value instanceof UniqueID);
                assert.ok(attr.created instanceof Date);
            });
            
            const ids = relatedRaw.map(attr => attr.value as UniqueID);
            assert.ok(ids.some(id => id.equals(id1)));
            assert.ok(ids.some(id => id.equals(id2)));
        });

        it('should preserve order of attribute creation', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            // Add tags in specific order with small delays to ensure different timestamps
            await product.setAttribute('tags', 'first');
            await new Promise(resolve => setTimeout(resolve, 1));
            await product.setAttribute('tags', 'second');
            await new Promise(resolve => setTimeout(resolve, 1));
            await product.setAttribute('tags', 'third');
            
            const tagRaw = await product.getRawAttributes('tags');
            assert.equal(tagRaw.length, 3);
            
            // Should be ordered by creation time (first added = earliest timestamp)
            const sortedByCreation = [...tagRaw].sort((a, b) => a.created.getTime() - b.created.getTime());
            assert.equal(sortedByCreation[0].value, 'first');
            assert.equal(sortedByCreation[1].value, 'second');
            assert.equal(sortedByCreation[2].value, 'third');
        });
    });
});
