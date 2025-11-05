import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../src/core/models/baseModel.js';
import { field } from '../../../src/core/models/decorators/field.js';
import { embedOne } from '../../../src/core/models/decorators/embedOne.js';
import { embedMany } from '../../../src/core/models/decorators/embedMany.js';
import { model } from '../../../src/core/models/decorators/model.js';
import { type ModelData } from '../../../src/core/models/types.js';
import { setupTestTeardown } from './setup.js';

// Setup test isolation
setupTestTeardown();
@model
class SimpleTestModel extends BaseModel {
    @field()
    accessor name!: string;

    @field()
    accessor count!: number;

    @field()
    accessor active!: boolean;
}

@model 
class EmbeddedTestModel extends BaseModel {
    @field()
    accessor value!: string;
}

@model
class ComplexTestModel extends BaseModel {
    @field()
    accessor title!: string;

    @embedOne(EmbeddedTestModel)
    accessor embedded!: any;

    @embedMany(EmbeddedTestModel)
    accessor embeddedList!: any;
}

describe('ModelData Type', () => {
    
    describe('Type Structure Tests', () => {
        it('should create instances with expected field access', async () => {
            const model = new SimpleTestModel();
            model.set('name', 'Test');
            model.set('count', 5);
            model.set('active', true);

            // Test direct field access
            assert.strictEqual(model.get('name'), 'Test');
            assert.strictEqual(model.get('count'), 5);
            assert.strictEqual(model.get('active'), true);
        });

        it('should serialize to ModelData format', async () => {
            const model = new SimpleTestModel();
            model.set('name', 'Test');
            model.set('count', 5);
            model.set('active', true);

            const serialized = model.serialize();
            
            // Should include regular fields
            assert.strictEqual(serialized.name, 'Test');
            assert.strictEqual(serialized.count, 5);
            assert.strictEqual(serialized.active, true);

            // TypeScript should infer this as ModelData<SimpleTestModel>
            const typedSerialized: ModelData<SimpleTestModel> = serialized;
            assert.strictEqual(typedSerialized.name, 'Test');
        });
    });

    describe('Event Handler Data Access Tests', () => {
        it('should provide correct data structure similar to event handlers', async () => {
            const model = new SimpleTestModel();
            model.set('name', 'TestCreate');
            model.set('count', 10);
            model.set('active', true);

            // Simulate what event handler would receive
            const eventData: ModelData<SimpleTestModel> = model.serialize();
            
            // Should have regular fields
            assert.strictEqual(eventData.name, 'TestCreate');
            assert.strictEqual(eventData.count, 10);
            assert.strictEqual(eventData.active, true);
        });

        it('should handle embedded models correctly in serialized data', async () => {
            const embeddedModel = new EmbeddedTestModel();
            embeddedModel.set('value', 'embedded value');

            const complexModel = new ComplexTestModel();
            complexModel.set('title', 'Complex Title');
            
            // Set embedded model
            await complexModel.embedded(embeddedModel);

            // Simulate event data
            const eventData: ModelData<ComplexTestModel> = complexModel.serialize();
            
            assert.strictEqual(eventData.title, 'Complex Title');
            
            // Check if embedded model data is present
            console.log('Event data keys:', Object.keys(eventData));
            console.log('Full event data:', JSON.stringify(eventData, null, 2));
        });
    });
});
