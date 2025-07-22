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
@model
class TestProduct extends Attributable(BaseModel) {
    @field()
    accessor name!: string;
    
    @field()
    accessor price!: number;

    // Define the attributes specification as a readonly property
    public readonly Attributes = {
        color:          [String, 'single'],
        isPublished:    [Boolean, 'single'],
        inventoryCount: [Number, 'single'],
        tags:           [String, 'many'],
        relatedProducts: [UniqueID, 'many'],
    } as const;
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
            const hasId1 = relatedProducts.some((id) => id instanceof UniqueID && id.equals(relatedId1));
            const hasId2 = relatedProducts.some((id) => id instanceof UniqueID && id.equals(relatedId2));
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
            const duplicates = tags.filter((tag) => tag === 'duplicate');
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
    });
});
