/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../../src/core/models/baseModel.js';
import { derived } from '../../../../src/core/models/decorators/derived.js';
import { field, FIELD_METADATA_SYMBOL } from '../../../../src/core/models/decorators/field.js';
import { model } from '../../../../src/core/models/decorators/model.js';
import { type Derived } from '../../../../src/core/models/types.js';
import { setupTestTeardown } from '../setup.js';

// Setup test isolation
setupTestTeardown();

describe('@derived decorator', () => {
    it('should only be applicable to methods', () => {
        assert.throws(() => {
            class TestModel extends BaseModel {
                // This should throw because @derived is applied to an accessor, not a method
                // @ts-expect-error - intentionally incorrect usage for testing
                @derived()
                accessor invalidField!: string;
            }
            void TestModel; // Avoid unused variable warning
        }, /can only be used on async methods/);
    });

    it('should attach metadata with derived: true', () => {
        class TestModel extends BaseModel {
            @derived()
            async computedValue(): Derived<Promise<string>> {
                return 'computed';
            }
        }

        // Get the method from the prototype
        const method = TestModel.prototype.computedValue;
        const metadata = (method as any)[FIELD_METADATA_SYMBOL];
        
        assert(metadata, 'Should have metadata attached');
        assert.strictEqual(metadata.name, 'computedValue');
        assert.strictEqual(metadata.meta.options.derived, true);
    });

    it('should work with different return types', () => {
        class TestModel extends BaseModel {
            @derived()
            async stringValue(): Derived<Promise<string>> {
                return 'test';
            }

            @derived()
            async numberValue(): Derived<Promise<number>> {
                return 42;
            }

            @derived()
            async booleanValue(): Derived<Promise<boolean>> {
                return true;
            }
        }

        // Verify all methods have the correct metadata
        const methods = ['stringValue', 'numberValue', 'booleanValue'];
        for (const methodName of methods) {
            const method = (TestModel.prototype as any)[methodName];
            const metadata = (method as any)[FIELD_METADATA_SYMBOL];
            assert(metadata, `${methodName} should have metadata`);
            assert.strictEqual(metadata.meta.options.derived, true);
        }
    });

    it('should work with field options', () => {
        class TestModel extends BaseModel {
            @derived({ readOnly: true })
            async readOnlyDerived(): Derived<Promise<string>> {
                return 'readonly';
            }
        }

        const method = TestModel.prototype.readOnlyDerived;
        const metadata = (method as any)[FIELD_METADATA_SYMBOL];
        
        assert.strictEqual(metadata.meta.options.derived, true);
        assert.strictEqual(metadata.meta.options.readOnly, true);
    });
});

describe('@derived integration with BaseModel', () => {
    it('should include derived fields in derive() output', async () => {
        @model
        class TestModel extends BaseModel {
            @field()
            accessor baseField!: string;

            @derived()
            async computedField(): Derived<Promise<string>> {
                return `computed from ${this.get('baseField') as string}`;
            }
        }

        const instance = new TestModel();
        instance.set('baseField', 'test');

        const derivedData = await instance.derive();
        
        assert.strictEqual(derivedData.baseField, 'test');
        assert.strictEqual(derivedData.computedField, 'computed from test');
    });

    it('should handle multiple derived fields', async () => {
        @model
        class TestModel extends BaseModel {
            @field()
            accessor name!: string;

            @field()
            accessor count!: number;

            @derived()
            async displayName(): Derived<Promise<string>> {
                const name = this.get('name') as string;
                return `Name: ${name}`;
            }

            @derived()
            async doubleCount(): Derived<Promise<number>> {
                const count = this.get('count') as number;
                return count * 2;
            }
        }

        const instance = new TestModel();
        instance.set('name', 'Test');
        instance.set('count', 5);

        const derivedData = await instance.derive();
        
        assert.strictEqual(derivedData.name, 'Test');
        assert.strictEqual(derivedData.count, 5);
        assert.strictEqual(derivedData.displayName, 'Name: Test');
        assert.strictEqual(derivedData.doubleCount, 10);
    });

    it('should not include derived fields in serialize() output', async () => {
        @model
        class TestModel extends BaseModel {
            @field()
            accessor baseField!: string;

            @derived()
            async computedField(): Derived<Promise<string>> {
                return 'computed';
            }
        }

        const instance = new TestModel();
        instance.set('baseField', 'test');

        const serialized = instance.serialize();
        
        assert.strictEqual(serialized.baseField, 'test');
        assert.strictEqual('computedField' in serialized, false);
    });

    it('should handle async derived methods', async () => {
        @model
        class TestModel extends BaseModel {
            @field()
            accessor value!: number;

            @derived()
            async asyncComputed(): Derived<Promise<string>> {
                // Simulate async operation
                await new Promise(resolve => setTimeout(resolve, 10));
                const value = this.get('value') as number;
                return `Async result: ${value}`;
            }
        }

        const instance = new TestModel();
        instance.set('value', 123);

        const derivedData = await instance.derive();
        
        assert.strictEqual(derivedData.asyncComputed, 'Async result: 123');
    });

    it('should handle derived methods that access model data', async () => {
        @model
        class TestModel extends BaseModel {
            @field()
            accessor firstName!: string;

            @field()
            accessor lastName!: string;

            @derived()
            async fullName(): Derived<Promise<string>> {
                const first = this.get('firstName') as string;
                const last = this.get('lastName') as string;
                return `${first} ${last}`;
            }

            @derived()
            async initials(): Derived<Promise<string>> {
                const first = this.get('firstName') as string;
                const last = this.get('lastName') as string;
                return `${first.charAt(0)}.${last.charAt(0)}.`;
            }
        }

        const instance = new TestModel();
        instance.set('firstName', 'John');
        instance.set('lastName', 'Doe');

        const derivedData = await instance.derive();
        
        assert.strictEqual(derivedData.fullName, 'John Doe');
        assert.strictEqual(derivedData.initials, 'J.D.');
    });

    it('should handle derived methods that throw errors gracefully', async () => {
        @model
        class TestModel extends BaseModel {
            @field()
            accessor value!: string;

            @derived()
            async failingDerived(): Derived<Promise<string>> {
                throw new Error('Computation failed');
            }

            @derived()
            async workingDerived(): Derived<Promise<string>> {
                return 'working';
            }
        }

        const instance = new TestModel();
        instance.set('value', 'test');

        // derive() should propagate the error from the failing derived method
        await assert.rejects(
            () => instance.derive(),
            /Computation failed/
        );
    });

    it('should work with inheritance', async () => {
        @model
        class BaseTestModel extends BaseModel {
            @field()
            accessor baseValue!: string;

            @derived()
            async baseDerived(): Derived<Promise<string>> {
                const baseValue = this.get('baseValue') as string;
                return `base: ${baseValue}`;
            }
        }

        @model
        class ChildTestModel extends BaseTestModel {
            @field()
            accessor childValue!: string;

            @derived()
            async childDerived(): Derived<Promise<string>> {
                const childValue = this.get('childValue') as string;
                return `child: ${childValue}`;
            }
        }

        const instance = new ChildTestModel();
        instance.set('baseValue', 'base');
        instance.set('childValue', 'child');

        const derivedData = await instance.derive();
        
        assert.strictEqual(derivedData.baseDerived, 'base: base');
        assert.strictEqual(derivedData.childDerived, 'child: child');
    });

    it('should handle derived methods with default values', async () => {
        @model
        class TestModel extends BaseModel {
            @field()
            accessor optionalField!: string;

            @derived()
            async derivedWithDefault(): Derived<Promise<string>> {
                const value = this.get('optionalField') as string | undefined;
                return value || 'default value';
            }
        }

        const instance = new TestModel();
        
        // Test with no value set (undefined)
        let derivedData = await instance.derive();
        assert.strictEqual(derivedData.derivedWithDefault, 'default value');

        // Test with value set
        instance.set('optionalField', 'custom');
        derivedData = await instance.derive();
        assert.strictEqual(derivedData.derivedWithDefault, 'custom');
    });
});
