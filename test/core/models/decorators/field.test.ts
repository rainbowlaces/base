 
 
 

import { describe, it, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../../src/core/models/baseModel.js';
import { field, FIELD_METADATA_SYMBOL } from '../../../../src/core/models/decorators/field.js';
import { model } from '../../../../src/core/models/decorators/model.js';
import { setupTestTeardown } from '../setup.js';

// Setup test isolation
setupTestTeardown();

describe('@field decorator', () => {
    it('should create a getter that calls this.get()', () => {
        @model
        class TestModel extends BaseModel {
            @field()
            accessor testField!: string;
        }

        const instance = new TestModel();
        const getSpy = test.mock.method(instance, 'get');
        getSpy.mock.mockImplementation(() => 'mockValue' as any); // Mock to return a value
        
        // Access the field
        const value = instance.testField;
        void value; // Avoid unused variable warning
        
        assert.strictEqual(getSpy.mock.callCount(), 1);
        assert.strictEqual(getSpy.mock.calls[0]?.arguments[0], 'testField');
    });

    it('should create a setter that calls this.set()', () => {
        @model
        class TestModel extends BaseModel {
            @field()
            accessor testField!: string;
        }

        const instance = new TestModel();
        const setSpy = test.mock.method(instance, 'set');
        
        // Set the field
        instance.testField = 'test value';
        
        assert.strictEqual(setSpy.mock.callCount(), 1);
        assert.strictEqual(setSpy.mock.calls[0]?.arguments[0], 'testField');
        assert.strictEqual(setSpy.mock.calls[0]?.arguments[1], 'test value');
    });

    it('should respect the readOnly option', () => {
        @model
        class TestModel extends BaseModel {
            @field({ readOnly: true })
            accessor readOnlyField!: string;
        }

        const instance = new TestModel();
        
        // Should be able to get
        const getSpy = test.mock.method(instance, 'get');
        getSpy.mock.mockImplementation(() => 'mockValue' as any); // Mock to return a value
        const value = instance.readOnlyField;
        void value; // Avoid unused variable warning
        assert.strictEqual(getSpy.mock.callCount(), 1);
        
        // Should throw error when trying to set readOnly field
        assert.throws(() => {
            instance.readOnlyField = 'test';
        }, /readonly and cannot be set/);
    });

    it('should apply default values (function)', () => {
        const defaultFn = () => 'default value';
        
        class TestModel extends BaseModel {
            @field({ default: defaultFn })
            accessor fieldWithDefault!: string;
        }

        // Check that the metadata contains the default
        const descriptor = Object.getOwnPropertyDescriptor(TestModel.prototype, 'fieldWithDefault');
        const { get: getterFn } = descriptor || {};
        assert(getterFn, 'Getter should exist');
        
        const metadata = (getterFn as any)[FIELD_METADATA_SYMBOL];
        assert(metadata, 'Metadata should be attached');
        assert.strictEqual(metadata.meta.options.default, defaultFn);
    });

    it('should apply default values (arrow function)', () => {
        const defaultFn = () => 'computed default';
        
        class TestModel extends BaseModel {
            @field({ default: defaultFn })
            accessor fieldWithDefaultFn!: string;
        }

        // Check that the metadata contains the default function
        const descriptor = Object.getOwnPropertyDescriptor(TestModel.prototype, 'fieldWithDefaultFn');
        const getterFn = descriptor?.get;
        assert(getterFn, 'Getter should exist');
        
        const metadata = (getterFn as any)[FIELD_METADATA_SYMBOL];
        assert(metadata, 'Metadata should be attached');
        assert.strictEqual(metadata.meta.options.default, defaultFn);
    });

    it('should attach field metadata to the getter function', () => {
        class TestModel extends BaseModel {
            @field({ readOnly: true, default: () => 'test' })
            accessor annotatedField!: string;
        }

        const descriptor = Object.getOwnPropertyDescriptor(TestModel.prototype, 'annotatedField');
        const getterFn = descriptor?.get;
        assert(getterFn, 'Getter should exist');
        
        const metadata = (getterFn as any)[FIELD_METADATA_SYMBOL];
        assert(metadata, 'Metadata should be attached');
        
        // Check the metadata structure
        assert.strictEqual(metadata.name, 'annotatedField');
        assert.strictEqual(metadata.meta.options.readOnly, true);
        assert.strictEqual(typeof metadata.meta.options.default, 'function');
    });

    it('should support extending field options with additional metadata', () => {
        class TestModel extends BaseModel {
            @field({ 
                readOnly: true, 
                default: () => 'test',
                // Additional metadata (relation example)
                relation: { type: 'reference', model: BaseModel, cardinality: 'one' }
            } as any)
            accessor complexField!: string;
        }

        const descriptor = Object.getOwnPropertyDescriptor(TestModel.prototype, 'complexField');
        const getterFn = descriptor?.get;
        assert(getterFn, 'Getter should exist');
        
        const metadata = (getterFn as any)[FIELD_METADATA_SYMBOL];
        assert(metadata, 'Metadata should be attached');
        
        // Check that additional metadata is preserved
        assert.deepStrictEqual(metadata.meta.relation, { 
            type: 'reference', 
            model: BaseModel, 
            cardinality: 'one' 
        });
    });

    it('should create enumerable and configurable properties', () => {
        class TestModel extends BaseModel {
            @field()
            accessor testField!: string;
        }

        const descriptor = Object.getOwnPropertyDescriptor(TestModel.prototype, 'testField');
        assert(descriptor, 'Property descriptor should exist');
        assert.strictEqual(descriptor.enumerable, true);
        assert.strictEqual(descriptor.configurable, true);
    });

    it('should work with different value types', () => {
        @model
        class TestModel extends BaseModel {
            @field()
            accessor stringField!: string;

            @field()
            accessor numberField!: number;

            @field()
            accessor booleanField!: boolean;

            @field()
            accessor dateField!: Date;

            @field()
            accessor arrayField!: string[];

            @field()
            accessor objectField!: { key: string };
        }

        const instance = new TestModel();
        const setSpy = test.mock.method(instance, 'set');
        const getSpy = test.mock.method(instance, 'get');

        // Test setting different types
        instance.stringField = 'test';
        instance.numberField = 42;
        instance.booleanField = true;
        instance.dateField = new Date();
        instance.arrayField = ['a', 'b'];
        instance.objectField = { key: 'value' };

        assert.strictEqual(setSpy.mock.callCount(), 6);

        // Test getting different types  
        void instance.stringField;
        void instance.numberField;
        void instance.booleanField;
        void instance.dateField;
        void instance.arrayField;
        void instance.objectField;

        assert.strictEqual(getSpy.mock.callCount(), 6);
    });
});
