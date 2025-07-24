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
    color: [String, 'single'],
    tags: [String, 'many'],
    persona: [UniqueID, 'single'],
} as const;

@model
class TestProduct extends Attributable<typeof TEST_PRODUCT_ATTRIBUTES, typeof BaseModel>(BaseModel) {
    @field()
    accessor name!: string;
    
    @field()
    accessor price!: number;

    public readonly Attributes = TEST_PRODUCT_ATTRIBUTES;
}

describe('Attributable Generic Mixin', () => {
    describe('Type Safety', () => {
        it('should provide type safety for attribute names', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            
            // These should work - valid attribute names
            await product.setAttribute('color', 'red');
            await product.setAttribute('tags', 'electronics');
            
            const color = await product.getAttribute('color');
            const tags = await product.getAttribute('tags');
            
            // TypeScript should infer correct types:
            // color: string | undefined (single cardinality)
            // tags: string[] (many cardinality)
            
            assert.equal(color, 'red');
            assert.deepEqual(tags, ['electronics']);
        });

        it('should handle UniqueID single cardinality correctly', async () => {
            const product = await TestProduct.create({ name: 'Test Product', price: 100 });
            const personaId = new UniqueID();
            
            await product.setAttribute('persona', personaId);
            const retrieved = await product.getAttribute('persona');
            
            // TypeScript should know this is UniqueID | undefined
            assert.ok(retrieved instanceof UniqueID);
            assert.ok(retrieved.equals(personaId));
        });
    });
});
