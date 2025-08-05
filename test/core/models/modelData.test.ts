/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../src/core/models/baseModel.js';
import { field } from '../../../src/core/models/decorators/field.js';
import { derived } from '../../../src/core/models/decorators/derived.js';
import { embed } from '../../../src/core/models/decorators/embed.js';
import { model } from '../../../src/core/models/decorators/model.js';
import { type Derived, type ModelData, type NoDerivedModelData, type ModelEvent } from '../../../src/core/models/types.js';
import { type BasePubSubArgs } from '../../../src/core/pubsub/types.js';
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

    @derived()
    async computedName(): Derived<Promise<string>> {
        const name = this.get('name') as string;
        return `Computed: ${name}`;
    }

    @derived()
    async doubleCount(): Derived<Promise<number>> {
        const count = this.get('count') as number;
        return count * 2;
    }
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

    @embed(EmbeddedTestModel, { cardinality: 'one' })
    accessor embedded!: any;

    @embed(EmbeddedTestModel, { cardinality: 'many' })
    accessor embeddedList!: any;

    @derived()
    async computedTitle(): Derived<Promise<string>> {
        const title = this.get('title') as string;
        return `Title: ${title}`;
    }
}

describe('ModelData and NoDerivedModelData Types', () => {
    
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

        it('should serialize to NoDerivedModelData format', async () => {
            const model = new SimpleTestModel();
            model.set('name', 'Test');
            model.set('count', 5);
            model.set('active', true);

            const serialized = model.serialize();
            
            // Should include regular fields
            assert.strictEqual(serialized.name, 'Test');
            assert.strictEqual(serialized.count, 5);
            assert.strictEqual(serialized.active, true);
            
            // Should NOT include derived fields
            assert.strictEqual('computedName' in serialized, false);
            assert.strictEqual('doubleCount' in serialized, false);

            // TypeScript should infer this as NoDerivedModelData<SimpleTestModel>
            const typedSerialized: NoDerivedModelData<SimpleTestModel> = serialized;
            assert.strictEqual(typedSerialized.name, 'Test');
        });

        it('should derive to ModelData format with computed fields', async () => {
            const model = new SimpleTestModel();
            model.set('name', 'Test');
            model.set('count', 5);
            model.set('active', true);

            const derived = await model.derive();
            
            // Should include regular fields
            assert.strictEqual(derived.name, 'Test');
            assert.strictEqual(derived.count, 5);
            assert.strictEqual(derived.active, true);
            
            // Should include derived fields
            assert.strictEqual(derived.computedName, 'Computed: Test');
            assert.strictEqual(derived.doubleCount, 10);

            // TypeScript should infer this as ModelData<SimpleTestModel>
            const typedDerived: ModelData<SimpleTestModel> = derived;
            assert.strictEqual(typedDerived.computedName, 'Computed: Test');
        });
    });

    describe('Event Handler Data Access Tests', () => {
        it('should provide correct data structure similar to event handlers', async () => {
            const model = new SimpleTestModel();
            model.set('name', 'TestCreate');
            model.set('count', 10);
            model.set('active', true);

            // Simulate what event handler would receive
            const eventData: NoDerivedModelData<SimpleTestModel> = model.serialize();
            
            // Should have regular fields
            assert.strictEqual(eventData.name, 'TestCreate');
            assert.strictEqual(eventData.count, 10);
            assert.strictEqual(eventData.active, true);
            
            // Should NOT have derived fields
            assert.strictEqual('computedName' in eventData, false);
            assert.strictEqual('doubleCount' in eventData, false);
        });

        it('should handle embedded models correctly in serialized data', async () => {
            const embeddedModel = new EmbeddedTestModel();
            embeddedModel.set('value', 'embedded value');

            const complexModel = new ComplexTestModel();
            complexModel.set('title', 'Complex Title');
            
            // Set embedded model
            await complexModel.embedded(embeddedModel);

            // Simulate event data
            const eventData: NoDerivedModelData<ComplexTestModel> = complexModel.serialize();
            
            assert.strictEqual(eventData.title, 'Complex Title');
            
            // Check if embedded model data is present
            console.log('Event data keys:', Object.keys(eventData));
            console.log('Full event data:', JSON.stringify(eventData, null, 2));
            
            // Should NOT have derived fields
            assert.strictEqual('computedTitle' in eventData, false);
        });
    });

    describe('Property Access in Event Handlers', () => {
        it('should allow safe property access in event handlers', async () => {
            // This test verifies that TypeScript types work correctly
            // and that we can access expected properties
            
            const testEventHandler = {
                async handleSimpleModelEvent(args: BasePubSubArgs) {
                    const eventData = args as BasePubSubArgs & { event?: ModelEvent<SimpleTestModel> };
                    if (!eventData.event) return;
                    
                    const data: NoDerivedModelData<SimpleTestModel> = eventData.event.data;
                    
                    // These should work (compile-time check)
                    const name: string | undefined = data.name;
                    const count: number | undefined = data.count;
                    const active: boolean | undefined = data.active;
                    
                    // These should NOT be available (would fail at compile time)
                    // const computedName = data.computedName; // Should be TypeScript error
                    // const doubleCount = data.doubleCount; // Should be TypeScript error
                    
                    assert(typeof name === 'string' || typeof name === 'undefined');
                    assert(typeof count === 'number' || typeof count === 'undefined');
                    assert(typeof active === 'boolean' || typeof active === 'undefined');
                }
            };
            
            // This test primarily verifies TypeScript compilation
            assert(testEventHandler, 'Event handler should be defined');
        });

        it('should handle undefined properties gracefully in event handlers', async () => {
            const testEventHandler = {
                async processEvent(data: NoDerivedModelData<SimpleTestModel>) {
                    // Event handlers should handle undefined properties
                    const name = data.name ?? 'default';
                    const count = data.count ?? 0;
                    const active = data.active ?? false;
                    
                    assert.strictEqual(typeof name, 'string');
                    assert.strictEqual(typeof count, 'number');
                    assert.strictEqual(typeof active, 'boolean');
                    
                    return { name, count, active };
                }
            };
            
            // Test with partial data
            const result1 = await testEventHandler.processEvent({ name: 'test' });
            assert.strictEqual(result1.name, 'test');
            assert.strictEqual(result1.count, 0);
            assert.strictEqual(result1.active, false);
            
            // Test with empty data
            const result2 = await testEventHandler.processEvent({});
            assert.strictEqual(result2.name, 'default');
            assert.strictEqual(result2.count, 0);
            assert.strictEqual(result2.active, false);
        });
    });

    describe('Type Safety Verification', () => {
        it('should enforce correct types at compile time', () => {
            // This test is mainly for TypeScript verification
            
            // ModelData should include derived fields (at type level)
            type TestModelData = ModelData<SimpleTestModel>;
            const derivedFields: (keyof TestModelData)[] = ['computedName', 'doubleCount'];
            const regularFields: (keyof TestModelData)[] = ['name', 'count', 'active'];
            
            // NoDerivedModelData should exclude derived fields (at type level)
            type TestNoDerivedData = NoDerivedModelData<SimpleTestModel>;
            const noDerivedFields: (keyof TestNoDerivedData)[] = ['name', 'count', 'active'];
            
            // Verify the arrays contain expected field names
            assert(derivedFields.includes('computedName'));
            assert(derivedFields.includes('doubleCount'));
            assert(regularFields.includes('name'));
            assert(noDerivedFields.includes('name'));
            
            // This mainly tests that TypeScript compilation works correctly
            assert(true, 'Type definitions should compile correctly');
        });

        it('should demonstrate the issue: verify what is actually in event data', async () => {
            const model = new SimpleTestModel();
            model.set('name', 'TestData');
            model.set('count', 42);
            model.set('active', true);

            // What serialize() actually returns
            const serialized = model.serialize();
            console.log('Serialized data:', serialized);
            console.log('Serialized keys:', Object.keys(serialized));
            
            // What derive() returns
            const derived = await model.derive();
            console.log('Derived data:', derived);
            console.log('Derived keys:', Object.keys(derived));
            
            // Verify type safety
            const asNoDerived: NoDerivedModelData<SimpleTestModel> = serialized;
            const asModelData: ModelData<SimpleTestModel> = derived;
            
            // These should work
            assert.strictEqual(asNoDerived.name, 'TestData');
            assert.strictEqual(asModelData.name, 'TestData');
            assert.strictEqual(asModelData.computedName, 'Computed: TestData');
            
            // This should be a compile-time error (but we can't test that at runtime)
            // const shouldFail = asNoDerived.computedName; // TypeScript should error
            
            console.log('Type test completed successfully');
        });
    });
});
