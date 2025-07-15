import { describe, it, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../../src/core/models/baseModel.js';
import { field } from '../../../../src/core/models/decorators/field.js';
import { model } from '../../../../src/core/models/decorators/model.js';
import { BaseDi } from '../../../../src/core/di/baseDi.js';
import { setupTestTeardown } from '../setup.js';

// Extend ModelMetadata for testing
declare module '../../../../src/core/models/types.js' {
    interface ModelMetadata {
        testMeta?: string;
    }
}

// Setup test isolation
setupTestTeardown();

describe('@model decorator hook functionality', () => {
    it('should call onModelRegistered hook after applying @model decorator', () => {
        let hookCalled = false;
        
        class TestModel extends BaseModel {
            @field()
            accessor name!: string;

            protected static onModelRegistered(): void {
                hookCalled = true;
            }
        }

        // Hook should not be called yet
        assert.strictEqual(hookCalled, false);

        // Apply the @model decorator
        model(TestModel);

        // Hook should now be called
        assert.strictEqual(hookCalled, true);
    });

    it('should call hook after field collection', () => {
        let schemaAtHookTime: any = null;
        
        class TestModel extends BaseModel {
            @field()
            accessor name!: string;

            @field({ readOnly: true })
            accessor id!: string;

            protected static onModelRegistered(): void {
                // At this point, fields should be collected
                schemaAtHookTime = this.getProcessedSchema();
            }
        }

        // Apply the @model decorator
        model(TestModel);

        // Verify fields were collected before hook
        assert(schemaAtHookTime !== null, 'Schema should be captured in hook');
        assert('name' in schemaAtHookTime.fields, 'Should have name field');
        assert('id' in schemaAtHookTime.fields, 'Should have id field');
        assert.strictEqual(schemaAtHookTime.fields.id.options.readOnly, true, 'Should preserve field options');
    });

    it('should call hook after DI registration', () => {
        let hookCalled = false;
        
        class TestModel extends BaseModel {
            @field()
            accessor name!: string;

            protected static onModelRegistered(): void {
                hookCalled = true;
            }
        }

        // Verify the class gets registered with DI
        const registerSpy = test.mock.method(BaseDi, 'register');

        model(TestModel);

        // Both DI registration and hook should have been called
        assert.strictEqual(registerSpy.mock.callCount(), 1, 'Should register with DI');
        assert.strictEqual(hookCalled, true, 'Hook should be called');
        
        registerSpy.mock.restore();
    });

    it('should allow subclasses to override the hook', () => {
        const callOrder: string[] = [];
        
        class ParentModel extends BaseModel {
            @field()
            accessor parentField!: string;

            protected static onModelRegistered(): void {
                callOrder.push('parent');
            }
        }

        class ChildModel extends ParentModel {
            @field()
            accessor childField!: string;

            protected static onModelRegistered(): void {
                callOrder.push('child');
                // Child can call parent if needed
                super.onModelRegistered();
            }
        }

        // Apply decorators
        model(ParentModel);
        model(ChildModel);

        // Verify both hooks were called correctly
        assert.deepStrictEqual(callOrder, ['parent', 'child', 'parent']);
    });

    it('should provide access to processed schema in hook', () => {
        let capturedSchema: any = null;
        
        class TestModel extends BaseModel {
            @field()
            accessor name!: string;

            @field({ readOnly: true })
            accessor id!: string;

            protected static onModelRegistered(): void {
                capturedSchema = this.getProcessedSchema();
            }
        }

        model(TestModel);

        // Verify schema is available and correct
        assert(capturedSchema !== null, 'Schema should be captured');
        assert('name' in capturedSchema.fields, 'Should have name field');
        assert('id' in capturedSchema.fields, 'Should have id field');
        assert.strictEqual(capturedSchema.fields.id.options.readOnly, true, 'Should preserve field options');
    });

    it('should handle errors in hook gracefully', () => {
        class TestModel extends BaseModel {
            @field()
            accessor name!: string;

            protected static onModelRegistered(): void {
                throw new Error('Hook error');
            }
        }

        // Hook error should propagate (not be silently swallowed)
        assert.throws(() => {
            model(TestModel);
        }, /Hook error/);
    });

    it('should work with inheritance chains', () => {
        const hookCalls: string[] = [];
        
        class GrandParent extends BaseModel {
            @field()
            accessor grandParentField!: string;

            protected static onModelRegistered(): void {
                hookCalls.push('grandparent');
            }
        }

        class Parent extends GrandParent {
            @field()
            accessor parentField!: string;

            protected static onModelRegistered(): void {
                hookCalls.push('parent');
                super.onModelRegistered();
            }
        }

        class Child extends Parent {
            @field()
            accessor childField!: string;

            protected static onModelRegistered(): void {
                hookCalls.push('child');
                super.onModelRegistered();
            }
        }

        // Apply decorators to each level
        model(GrandParent);
        model(Parent);
        model(Child);

        // Each class should have its own hook called
        assert.deepStrictEqual(hookCalls, [
            'grandparent',
            'parent', 'grandparent',
            'child', 'parent', 'grandparent'
        ]);
    });

    it('should only call hook once per @model application', () => {
        let hookCallCount = 0;
        
        class TestModel extends BaseModel {
            @field()
            accessor name!: string;

            protected static onModelRegistered(): void {
                hookCallCount++;
            }
        }

        // Apply decorator multiple times
        model(TestModel);
        model(TestModel);
        model(TestModel);

        // Hook should be called each time decorator is applied
        assert.strictEqual(hookCallCount, 3);
    });

    it('should work with models that have no fields', () => {
        let hookCalled = false;
        
        class EmptyModel extends BaseModel {
            protected static onModelRegistered(): void {
                hookCalled = true;
            }
        }

        model(EmptyModel);

        assert.strictEqual(hookCalled, true, 'Hook should be called even for models with no fields');
    });

    it('should work with models that have metadata', () => {
        let capturedSchema: any = null;
        
        class TestModel extends BaseModel {
            @field()
            accessor name!: string;

            protected static onModelRegistered(): void {
                capturedSchema = this.getProcessedSchema();
            }
        }

        // Add some metadata manually (since we don't have @meta decorator in this test)
        (TestModel as any).setMetaValue('testMeta', 'test-value');

        model(TestModel);

        assert(capturedSchema !== null, 'Schema should be captured');
        assert.strictEqual(capturedSchema.meta.testMeta, 'test-value', 'Metadata should be available in hook');
    });

    it('should have access to constructor context in hook', () => {
        let constructorName: string = '';
        let hasGetProcessedSchema = false;
        
        class TestModel extends BaseModel {
            @field()
            accessor name!: string;

            protected static onModelRegistered(): void {
                constructorName = this.name;
                hasGetProcessedSchema = typeof this.getProcessedSchema === 'function';
            }
        }

        model(TestModel);

        assert.strictEqual(constructorName, 'TestModel', 'Hook should have access to the constructor');
        assert.strictEqual(hasGetProcessedSchema, true, 'Should have access to static methods');
    });
});
