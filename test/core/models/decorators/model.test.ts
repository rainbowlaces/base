 

import { describe, it, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../../src/core/models/baseModel.js';
import { BaseIdentifiableModel } from '../../../../src/core/models/baseIdentifiableModel.js';
import { field } from '../../../../src/core/models/decorators/field.js';
import { model } from '../../../../src/core/models/decorators/model.js';
import { BaseDi } from '../../../../src/core/di/baseDi.js';
import { setupTestTeardown } from '../setup.js';

// Setup test isolation
setupTestTeardown();

describe('@model decorator', () => {
    it('should collect metadata from all decorated fields', () => {
        class TestModel extends BaseModel {
            @field()
            accessor name!: string;

            @field({ readOnly: true })
            accessor status!: string;

            @field({ default: () => new Date() })
            accessor createdAt!: Date;
        }

        // Spy on addField to see what gets collected
        const addFieldSpy = test.mock.method(TestModel, 'addField');

        // Apply the @model decorator
        model(TestModel);

        // Should have collected all three fields
        assert.strictEqual(addFieldSpy.mock.callCount(), 3);

        // Check that each field was added with correct metadata
        const calls = addFieldSpy.mock.calls;
        const fieldNames = calls.map(call => call.arguments[0]);
        assert(fieldNames.includes('name'));
        assert(fieldNames.includes('status'));
        assert(fieldNames.includes('createdAt'));

        // Check metadata for readOnly field
        const statusCall = calls.find(call => call.arguments[0] === 'status');
        assert(statusCall);
        assert.strictEqual(statusCall.arguments[1].options.readOnly, true);

        // Check metadata for field with default
        const createdAtCall = calls.find(call => call.arguments[0] === 'createdAt');
        assert(createdAtCall);
        assert.strictEqual(typeof createdAtCall.arguments[1].options.default, 'function');
    });

    it('should collect metadata from parent classes (inheritance)', () => {
        class ParentModel extends BaseModel {
            @field()
            accessor parentField!: string;
        }

        class ChildModel extends ParentModel {
            @field()
            accessor childField!: string;
        }

        // Spy on addField for child class
        const addFieldSpy = test.mock.method(ChildModel, 'addField');

        // Apply the @model decorator to child
        model(ChildModel);

        // Should collect fields from both parent and child
        assert.strictEqual(addFieldSpy.mock.callCount(), 2);

        const calls = addFieldSpy.mock.calls;
        const fieldNames = calls.map(call => call.arguments[0]);
        assert(fieldNames.includes('parentField'));
        assert(fieldNames.includes('childField'));
    });

    it('should register the finalized class with the DI container', () => {
        class TestModel extends BaseModel {
            @field()
            accessor name!: string;
        }

        // Spy on DI registration
        const registerSpy = test.mock.method(BaseDi, 'register');

        // Apply the @model decorator
        model(TestModel);

        // Should have registered the class
        assert.strictEqual(registerSpy.mock.callCount(), 1);
        assert.strictEqual(registerSpy.mock.calls[0]?.arguments[0], TestModel);
        
        // Should have registration options (we'll trust the registerDi decorator handles them correctly)
        assert(registerSpy.mock.calls[0]?.arguments[1] !== undefined);
    });

    it('should work with identifiable models', () => {
        class TestUser extends BaseIdentifiableModel {
            @field()
            accessor name!: string;

            @field()
            accessor email!: string;
        }

        const addFieldSpy = test.mock.method(TestUser, 'addField');
        const registerSpy = test.mock.method(BaseDi, 'register');

        // Apply the @model decorator
        model(TestUser);

        // Should collect the decorated fields (including id field from BaseIdentifiableModel)
        assert.strictEqual(addFieldSpy.mock.callCount(), 3);
        
        const fieldNames = addFieldSpy.mock.calls.map(call => call.arguments[0]);
        assert(fieldNames.includes('id'));
        assert(fieldNames.includes('name'));
        assert(fieldNames.includes('email'));

        // Should register with DI
        assert.strictEqual(registerSpy.mock.callCount(), 1);
        assert.strictEqual(registerSpy.mock.calls[0]?.arguments[0], TestUser);
    });

    it('should handle models with no decorated fields', () => {
        class EmptyModel extends BaseModel {
            // No decorated fields, just a regular method
            regularMethod(): string {
                return 'test';
            }
        }

        const addFieldSpy = test.mock.method(EmptyModel, 'addField');
        const registerSpy = test.mock.method(BaseDi, 'register');

        // Apply the @model decorator
        model(EmptyModel);

        // Should not collect any fields
        assert.strictEqual(addFieldSpy.mock.callCount(), 0);

        // Should still register with DI
        assert.strictEqual(registerSpy.mock.callCount(), 1);
        assert.strictEqual(registerSpy.mock.calls[0]?.arguments[0], EmptyModel);
    });

    it('should handle complex inheritance chains', () => {
        class GrandParent extends BaseModel {
            @field()
            accessor grandParentField!: string;
        }

        class Parent extends GrandParent {
            @field()
            accessor parentField!: string;
        }

        class Child extends Parent {
            @field()
            accessor childField!: string;
        }

        const addFieldSpy = test.mock.method(Child, 'addField');

        // Apply the @model decorator
        model(Child);

        // Should collect all fields from entire inheritance chain
        assert.strictEqual(addFieldSpy.mock.callCount(), 3);

        const fieldNames = addFieldSpy.mock.calls.map(call => call.arguments[0]);
        assert(fieldNames.includes('grandParentField'));
        assert(fieldNames.includes('parentField'));
        assert(fieldNames.includes('childField'));
    });

    it('should not duplicate fields when applied multiple times', () => {
        class TestModel extends BaseModel {
            @field()
            accessor name!: string;
        }

        const addFieldSpy = test.mock.method(TestModel, 'addField');

        // Apply the @model decorator multiple times
        model(TestModel);
        model(TestModel);

        // Should still only collect fields once per application
        // (Note: In real usage, @model should only be applied once, but this tests robustness)
        assert.strictEqual(addFieldSpy.mock.callCount(), 2); // Called once per decorator application
    });
});
