import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { setupTestTeardown } from './setup.js';
import { BaseModel } from '../../../src/core/models/baseModel.js';
import { field } from '../../../src/core/models/decorators/field.js';
import { model } from '../../../src/core/models/decorators/model.js';

// Setup test isolation
setupTestTeardown();

describe('BaseModel: Serializer Feature', () => {
    
    class TestSerializerModel extends BaseModel {
        @field()
        accessor normalField!: string;
        
        @field({ serializer: (value: Date) => value.toISOString() })
        accessor dateField!: Date;
        
        @field({ serializer: (value: string) => value.toUpperCase() })
        accessor uppercaseField!: string;
        
        @field({ serializer: (value: object) => JSON.stringify(value) })
        accessor objectField!: object;
        
        @field({ serializer: (value: number) => value > 100 ? value : undefined })
        accessor conditionalField!: number;
        
        @field({ 
            hydrator: (value: unknown) => parseInt(value as string, 10),
            serializer: (value: number) => value.toString()
        })
        accessor convertAndSerializeField!: number;
    }
    
    // Apply model decorator
    model(TestSerializerModel);
    
    it('should serialize fields with basic serializer functions', () => {
        const instance = new TestSerializerModel();
        const testDate = new Date('2025-07-15T10:00:00Z');
        
        instance.set('normalField', 'test');
        instance.set('dateField', testDate);
        instance.set('uppercaseField', 'hello world');
        
        const serialized = instance.serialize();
        
        assert.strictEqual(serialized.normalField, 'test', 'Normal field should serialize as-is');
        assert.strictEqual(serialized.dateField, '2025-07-15T10:00:00.000Z', 'Date should be serialized to ISO string');
        assert.strictEqual(serialized.uppercaseField, 'HELLO WORLD', 'String should be serialized to uppercase');
    });
    
    it('should serialize objects using custom serializer', () => {
        const instance = new TestSerializerModel();
        const testObject = { name: 'John', age: 30 };
        
        instance.set('objectField', testObject);
        
        const serialized = instance.serialize();
        
        assert.strictEqual(serialized.objectField, JSON.stringify(testObject), 'Object should be serialized to JSON string');
    });
    
    it('should exclude fields when serializer returns undefined', () => {
        const instance = new TestSerializerModel();
        
        instance.set('conditionalField', 50); // Below threshold
        
        const serialized = instance.serialize();
        
        assert.strictEqual('conditionalField' in serialized, false, 'Field returning undefined from serializer should be excluded');
        
        // Test with value above threshold
        instance.set('conditionalField', 150);
        const serialized2 = instance.serialize();
        
        assert.strictEqual(serialized2.conditionalField, 150, 'Field returning value from serializer should be included');
    });
    
    it('should work with both hydrator and serializer', () => {
        const instance = new TestSerializerModel();
        
        // Set as string, will be converted to number, then serialized back to string
        instance.set('convertAndSerializeField', '42' as any);
        
        // Check that it was converted properly
        assert.strictEqual(instance.get('convertAndSerializeField'), 42, 'Hydrator should parse string to number');
        
        const serialized = instance.serialize();
        
        assert.strictEqual(serialized.convertAndSerializeField, '42', 'Serializer should convert number back to string');
    });
    
    it('should handle serializer that returns different scalar types', () => {
        class ScalarTestModel extends BaseModel {
            @field({ serializer: (value: string) => value.length })
            accessor stringLengthField!: string;
            
            @field({ serializer: (value: string) => value === 'true' })
            accessor booleanField!: string;
            
            @field({ serializer: (value: Date) => value.getTime() })
            accessor timestampField!: Date;
        }
        
        model(ScalarTestModel);
        
        const instance = new ScalarTestModel();
        instance.set('stringLengthField', 'hello');
        instance.set('booleanField', 'true');
        instance.set('timestampField', new Date('2025-07-15'));
        
        const serialized = instance.serialize();
        
        assert.strictEqual(serialized.stringLengthField, 5, 'Should serialize to number');
        assert.strictEqual(serialized.booleanField, true, 'Should serialize to boolean');
        assert.strictEqual(typeof serialized.timestampField, 'number', 'Should serialize to number timestamp');
    });
    
    it('should handle serializer errors gracefully', () => {
        class ErrorTestModel extends BaseModel {
            @field({ serializer: (_value: string) => { throw new Error('Serializer error'); } })
            accessor errorField!: string;
        }
        
        model(ErrorTestModel);
        
        const instance = new ErrorTestModel();
        instance.set('errorField', 'test');
        
        // Should throw during serialization
        assert.throws(() => instance.serialize(), /Serializer error/, 'Should propagate serializer errors');
    });
    
    it('should handle complex nested serialization', () => {
        class NestedTestModel extends BaseModel {
            @field({ 
                serializer: (value: { items: string[] }) => ({
                    count: value.items.length,
                    first: value.items[0],
                    joined: value.items.join(',')
                })
            })
            accessor complexField!: { items: string[] };
        }
        
        model(NestedTestModel);
        
        const instance = new NestedTestModel();
        instance.set('complexField', { items: ['a', 'b', 'c'] });
        
        const serialized = instance.serialize();
        
        assert.deepStrictEqual(
            serialized.complexField, 
            { count: 3, first: 'a', joined: 'a,b,c' },
            'Should serialize complex nested objects'
        );
    });
    
    it('should work with inheritance', () => {
        class BaseSerializerModel extends BaseModel {
            @field({ serializer: (value: string) => value.toLowerCase() })
            accessor baseField!: string;
        }
        
        class ExtendedSerializerModel extends BaseSerializerModel {
            @field({ serializer: (value: string) => value.toUpperCase() })
            accessor extendedField!: string;
        }
        
        model(BaseSerializerModel);
        model(ExtendedSerializerModel);
        
        const instance = new ExtendedSerializerModel();
        instance.set('baseField', 'BASE');
        instance.set('extendedField', 'extended');
        
        const serialized = instance.serialize();
        
        assert.strictEqual(serialized.baseField, 'base', 'Base field should use lowercase serializer');
        assert.strictEqual(serialized.extendedField, 'EXTENDED', 'Extended field should use uppercase serializer');
    });
    
    it('should only apply serializer during serialize() call, not during get()', () => {
        const instance = new TestSerializerModel();
        const testDate = new Date('2025-07-15T10:00:00Z');
        
        instance.set('dateField', testDate);
        
        // get() should return the original value, not serialized
        const getValue = instance.get('dateField');
        assert.strictEqual(getValue, testDate, 'get() should return original Date object');
        assert.strictEqual(getValue instanceof Date, true, 'get() should return Date instance');
        
        // Only serialize() should apply the serializer
        const serialized = instance.serialize();
        assert.strictEqual(serialized.dateField, '2025-07-15T10:00:00.000Z', 'serialize() should return serialized string');
        assert.strictEqual(typeof serialized.dateField, 'string', 'serialize() should return string type');
    });
    
    it('should handle null and undefined values in serializer', () => {
        class NullTestModel extends BaseModel {
            @field({ serializer: (value: string | null) => value ? value.toUpperCase() : 'NULL_VALUE' })
            accessor nullableField!: string | null;
        }
        
        model(NullTestModel);
        
        const instance = new NullTestModel();
        
        instance.set('nullableField', 'test');
        let serialized = instance.serialize();
        assert.strictEqual(serialized.nullableField, 'TEST', 'Should serialize non-null value');
        
        instance.set('nullableField', null);
        serialized = instance.serialize();
        assert.strictEqual(serialized.nullableField, 'NULL_VALUE', 'Should handle null value in serializer');
    });
});
