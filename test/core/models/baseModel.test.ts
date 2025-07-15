/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { setupTestTeardown, TestProfile, type MockPubSub } from './setup.js';
import { BaseDi } from '../../../src/core/di/baseDi.js';
import { BaseModel } from '../../../src/core/models/baseModel.js';
import { field } from '../../../src/core/models/decorators/field.js';
import { model } from '../../../src/core/models/decorators/model.js';
import type { Persistable, Deletable } from '../../../src/core/models/types.js';

// Setup test isolation
setupTestTeardown();

describe('BaseModel: Instance State & Data Management', () => {
    it('should be "new" and "dirty" upon creation', async () => {
        const profile = new TestProfile();
        
        // A new model should be considered dirty and should attempt to persist when save() is called
        // Since TestProfile doesn't implement Persistable, it should throw an error about being not persistable
        await assert.rejects(
            () => profile.save(),
            {
                message: `Model 'TestProfile' does not implement the Persistable interface.`
            },
            'New model should be dirty and attempt to save'
        );
    });
    
    it('should correctly get, set, and check properties', () => {
        const profile = new TestProfile();
        
        // Test set/get with writeable field only
        profile.set('bio', 'Software developer from London');
        assert.strictEqual(profile.get('bio'), 'Software developer from London', 'Should return set value');
        
        // Test has for both writeable and readonly fields
        assert.strictEqual(profile.has('bio'), true, 'Should return true for writeable field after setting');
        assert.strictEqual(profile.has('viewCount'), false, 'Should return false for readonly field that has no value');
        assert.strictEqual(profile.has('nonexistent'), false, 'Should return false for non-existing properties');
        
        // Test that get throws for non-existing properties (schema enforcement)
        assert.throws(() => profile.get('nonexistent'), /Field "nonexistent" is not defined in the schema/, 'Should throw for non-existing properties');
        
        // Test that get returns undefined for readonly field that has no value
        assert.strictEqual(profile.get('viewCount'), undefined, 'Should return undefined when getting unset readonly field');
    });
    
    it('should manage dirty flag correctly during set operations', async () => {
        // Create a mock persistable model for testing dirty state
        class MockPersistableProfile extends TestProfile implements Persistable {
            persistCalled = false;
            
            async persist(): Promise<void> {
                this.persistCalled = true;
            }
        }
        
        const persistableProfile = new MockPersistableProfile();
        
        // Hydrate to simulate a loaded model (should not be dirty after hydrate)
        (persistableProfile as any).hydrate({ bio: 'Initial bio' });
        
        // After hydration, save() should do nothing (not call persist) since it's not dirty
        await persistableProfile.save();
        assert.strictEqual(persistableProfile.persistCalled, false, 'Should not call persist when not dirty');
        
        // Setting a field should make it dirty
        persistableProfile.set('bio', 'Updated bio');
        
        // Now save() should call persist since it's dirty
        await persistableProfile.save();
        assert.strictEqual(persistableProfile.persistCalled, true, 'Should call persist when dirty');
    });
    
    it('should reset model to initial state with reset()', () => {
        const profile = new TestProfile();
        
        // Simulate that the model was hydrated (no longer new)
        (profile as any).hydrate({ bio: 'Original bio' });
        profile.set('bio', 'Updated bio');
        
        // Reset should clear all data and make it new again
        profile.reset();
        
        // After reset, should behave like a fresh model
        assert.strictEqual(profile.has('bio'), false, 'Should not have bio field after reset');
        
        // Should be able to set again after reset
        profile.set('bio', 'New bio after reset');
        assert.strictEqual(profile.get('bio'), 'New bio after reset', 'Should be able to set new values after reset');
        
        // Should be dirty again (ready to save)
        assert.rejects(
            () => profile.save(),
            {
                message: `Model 'TestProfile' does not implement the Persistable interface.`
            },
            'Should be dirty and attempt to save after reset'
        );
    });
    
    it('should hydrate model from data using fromData static method', async () => {
        // Test the public static fromData method
        const originalData = { bio: 'Software engineer' };
        const profile = await TestProfile.fromData(originalData);
        
        // After hydration, should have the data
        assert.strictEqual(profile.get('bio'), 'Software engineer', 'Should have hydrated data');
        assert.strictEqual(profile.has('bio'), true, 'Should recognize hydrated field as present');
        
        // After hydration, should not be dirty or new
        assert.doesNotReject(() => profile.save(), 'Should not call persist when not dirty');
        
        // Can still be modified after hydration
        profile.set('bio', 'Updated bio');
        assert.strictEqual(profile.get('bio'), 'Updated bio', 'Should allow modification after hydration');
        
        // Now should be dirty and attempt to save
        await assert.rejects(
            () => profile.save(),
            {
                message: `Model 'TestProfile' does not implement the Persistable interface.`
            },
            'Should be dirty after modification and attempt to save'
        );
    });

    it('should throw for non-schema fields during hydration', async () => {
        // Test that hydration correctly throws for fields not in the schema
        const dataWithExtraFields = { 
            bio: 'Valid field', 
            extraField: 'should-be-rejected'
        };
        
        // Should throw when trying to hydrate with non-schema fields
        await assert.rejects(
            () => TestProfile.fromData(dataWithExtraFields),
            {
                message: 'Field "extraField" is not defined in the schema.'
            },
            'Should throw for non-schema fields during hydration'
        );
        
        // Should succeed with only schema fields
        const validData = { bio: 'Valid field' };
        const profile = await TestProfile.fromData(validData);
        assert.strictEqual(profile.get('bio'), 'Valid field', 'Should hydrate valid schema fields');
    });
    
    it('should serialise model data correctly', async () => {
        const profile = new TestProfile();
        
        // Empty model should serialize to empty object (no fields set)
        let serialized = profile.serialise();
        assert.deepStrictEqual(serialized, {}, 'Empty model should serialize to empty object');
        
        // Set some data and serialize
        profile.set('bio', 'Software engineer from London');
        serialized = profile.serialise();
        assert.deepStrictEqual(serialized, { bio: 'Software engineer from London' }, 'Should serialize set fields');
        
        // Should only include fields that are actually set (not all schema fields)
        assert.strictEqual(Object.hasOwnProperty.call(serialized, 'viewCount'), false, 'Should not include unset readonly fields');
        
        // Test with hydrated model
        const hydratedData = { bio: 'Original bio' };
        const hydratedProfile = new TestProfile();
        await (hydratedProfile as any).hydrate(hydratedData);
        
        const hydratedSerialized = hydratedProfile.serialise();
        // Should only serialize fields that are in the schema and set
        assert.deepStrictEqual(hydratedSerialized, { bio: 'Original bio' }, 'Should only serialize schema fields that are set');
    });
    
    it('should publish correct events when saving (create vs update)', async () => {
        // Create a persistable model for testing
        class MockPersistableProfile extends TestProfile implements Persistable {
            persistCalled = false;
            
            async persist(): Promise<void> {
                this.persistCalled = true;
            }
        }
        
        const profile = new MockPersistableProfile();
        
        // Get the mock PubSub to check published events
        const mockPubSub = BaseDi.resolve<MockPubSub>('BasePubSub');
        mockPubSub.clearEvents();
        
        // Set some data to make it dirty
        profile.set('bio', 'Test bio');
        
        // First save should publish "create" event (model is new)
        await profile.save();
        
        assert.strictEqual(mockPubSub.publishedEvents.length, 1, 'Should publish one event');
        const createEvent = mockPubSub.publishedEvents[0];
        assert.strictEqual(createEvent.topic, '/models/create/mock-persistable-profile', 'Should publish to correct create topic');
        assert.strictEqual(createEvent.data.event.type, 'create', 'Should be create event type');
        assert.strictEqual(createEvent.data.event.model, profile, 'Should include the model in event');
        assert.deepStrictEqual(createEvent.data.event.data, { bio: 'Test bio' }, 'Should include serialized data');
        
        // Clear events for next test
        mockPubSub.clearEvents();
        
        // Modify and save again - should publish "update" event (model is no longer new)
        profile.set('bio', 'Updated bio');
        await profile.save();
        
        assert.strictEqual(mockPubSub.publishedEvents.length, 1, 'Should publish one update event');
        const updateEvent = mockPubSub.publishedEvents[0];
        assert.strictEqual(updateEvent.topic, '/models/update/mock-persistable-profile', 'Should publish to correct update topic');
        assert.strictEqual(updateEvent.data.event.type, 'update', 'Should be update event type');
        assert.deepStrictEqual(updateEvent.data.event.data, { bio: 'Updated bio' }, 'Should include updated serialized data');
        
        // Verify persist was called
        assert.strictEqual(profile.persistCalled, true, 'Should have called persist method');
    });
    
    it('should publish correct events when removing (delete event)', async () => {
        // Create a deletable model for testing
        class MockDeletableProfile extends TestProfile implements Deletable {
            deleteCalled = false;
            
            async delete(): Promise<void> {
                this.deleteCalled = true;
            }
        }
        
        const profile = new MockDeletableProfile();
        
        // Hydrate to simulate an existing model
        (profile as any).hydrate({ bio: 'To be deleted' });
        
        // Get the mock PubSub to check published events
        const mockPubSub = BaseDi.resolve<MockPubSub>('BasePubSub');
        mockPubSub.clearEvents();
        
        // Remove the model
        await profile.remove();
        
        assert.strictEqual(mockPubSub.publishedEvents.length, 1, 'Should publish one event');
        const deleteEvent = mockPubSub.publishedEvents[0];
        assert.strictEqual(deleteEvent.topic, '/models/delete/mock-deletable-profile', 'Should publish to correct delete topic');
        assert.strictEqual(deleteEvent.data.event.type, 'delete', 'Should be delete event type');
        assert.strictEqual(deleteEvent.data.event.model, profile, 'Should include the model in event');
        assert.deepStrictEqual(deleteEvent.data.event.data, { bio: 'To be deleted' }, 'Should include original serialized data');
        
        // Verify delete was called
        assert.strictEqual(profile.deleteCalled, true, 'Should have called delete method');
        
        // Verify model state after remove - data should be cleared
        assert.strictEqual(profile.has('bio'), false, 'Should not have bio field after remove');
        
        // Model should be in "new" state after removal
        await assert.rejects(
            () => profile.save(),
            {
                message: `Model 'MockDeletableProfile' does not implement the Persistable interface.`
            },
            'Should be in new state and attempt to save after remove'
        );
    });
    
    it('should throw error when trying to remove non-deletable model', async () => {
        const profile = new TestProfile();
        
        // Set some data
        profile.set('bio', 'Cannot be deleted');
        
        // Should throw error because TestProfile doesn't implement Deletable
        await assert.rejects(
            () => profile.remove(),
            {
                message: `Model 'TestProfile' does not implement the Deletable interface.`
            },
            'Non-deletable model should throw error on remove'
        );
        
        // Data should still be there after failed remove
        assert.strictEqual(profile.get('bio'), 'Cannot be deleted', 'Data should remain after failed remove');
    });
    
    it('should revert model to original state when dirty', () => {
        const profile = new TestProfile();
        
        // Start with hydrated data to simulate a loaded model
        const originalData = { bio: 'Original bio content' };
        (profile as any).hydrate(originalData);
        
        // Verify original state
        assert.strictEqual(profile.get('bio'), 'Original bio content', 'Should have original data after hydration');
        
        // Modify the model to make it dirty
        profile.set('bio', 'Modified bio content');
        assert.strictEqual(profile.get('bio'), 'Modified bio content', 'Should have modified data after set');
        
        // Revert should restore the original data
        profile.revert();
        assert.strictEqual(profile.get('bio'), 'Original bio content', 'Should have original data after revert');
        
        // Model should no longer be dirty after revert
        assert.doesNotReject(() => profile.save(), 'Should not call persist when not dirty after revert');
        
        // Test revert on a new model (no original data)
        const newProfile = new TestProfile();
        newProfile.set('bio', 'Some data');
        
        // Revert on new model should clear all data
        newProfile.revert();
        assert.strictEqual(newProfile.has('bio'), false, 'Should not have any data after revert on new model');
        
        // Should be back to "new" state
        assert.rejects(
            () => newProfile.save(),
            {
                message: `Model 'TestProfile' does not implement the Persistable interface.`
            },
            'Should be in new dirty state after revert on new model'
        );
    });
    
    it('should maintain dirty and new state when persist fails', async () => {
        // Create a persistable model that will fail to persist
        class FailingPersistableProfile extends TestProfile implements Persistable {
            persistCalled = false;
            
            async persist(): Promise<void> {
                this.persistCalled = true;
                throw new Error('Database connection failed');
            }
        }
        
        const profile = new FailingPersistableProfile();
        
        // Set some data to make it dirty
        profile.set('bio', 'Test bio that fails to save');
        
        // save() should reject with the persist error
        await assert.rejects(
            () => profile.save(),
            {
                message: 'Database connection failed'
            },
            'save() should reject with persist error'
        );
        
        // Verify persist was actually called
        assert.strictEqual(profile.persistCalled, true, 'persist() should have been called');
        
        // Model should remain dirty after failed save (can attempt to save again)
        await assert.rejects(
            () => profile.save(),
            {
                message: 'Database connection failed'
            },
            'Model should remain dirty after failed save (save() still tries to persist)'
        );
        
        // Verify persist was called again (proves model is still dirty)
        assert.strictEqual(profile.persistCalled, true, 'persist() should have been called again');
        
        // Model should still be in "new" state after failed save
        // Test this by creating a successful persistable model to verify state difference
        class SuccessfulPersistableProfile extends TestProfile implements Persistable {
            persistCalled = false;
            
            async persist(): Promise<void> {
                this.persistCalled = true;
            }
        }
        
        const successProfile = new SuccessfulPersistableProfile();
        successProfile.set('bio', 'Success bio');
        
        const mockPubSub = BaseDi.resolve<MockPubSub>('BasePubSub');
        mockPubSub.clearEvents();
        
        // Successful save should publish create event and change state
        await successProfile.save();
        assert.strictEqual(mockPubSub.publishedEvents.length, 1, 'Should publish create event on success');
        assert.strictEqual(mockPubSub.publishedEvents[0].data.event.type, 'create', 'Should be create event');
        
        // Second save should not publish anything (no longer dirty or new)
        mockPubSub.clearEvents();
        await successProfile.save();
        assert.strictEqual(mockPubSub.publishedEvents.length, 0, 'Should not publish anything on second save when not dirty');
        
        // Failed model should still behave like first save (publish create if it were to succeed)
        // Since events are only published on success, we test this indirectly by verifying
        // the model remains dirty and attempting to save again
        profile.persistCalled = false; // Reset to track new calls
        
        await assert.rejects(
            () => profile.save(),
            {
                message: 'Database connection failed'
            },
            'Failed model should still attempt to save (indicating dirty and new state preserved)'
        );
        
        assert.strictEqual(profile.persistCalled, true, 'Failed model should still call persist (remains dirty)');
    });
    
    it('should do nothing when calling revert() on never-dirty model', () => {
        const profile = new TestProfile();
        
        // Hydrate to simulate a loaded, clean model
        (profile as any).hydrate({ bio: 'Original content' });
        
        // Verify model is not dirty and has the hydrated data
        assert.strictEqual(profile.get('bio'), 'Original content', 'Should have hydrated data');
        assert.doesNotReject(() => profile.save(), 'Should not be dirty after hydration');
        
        // Call revert() on never-dirty model - should do nothing
        profile.revert();
        
        // Model should still have the same data and still not be dirty
        assert.strictEqual(profile.get('bio'), 'Original content', 'Should still have original data after revert on clean model');
        assert.doesNotReject(() => profile.save(), 'Should still not be dirty after revert on clean model');
    });

    it('should revert new modified model to empty state', () => {
        const profile = new TestProfile();
        
        // Set some data on a new model (no hydration, so no original data)
        profile.set('bio', 'Some content');
        assert.strictEqual(profile.get('bio'), 'Some content', 'Should have set data');
        
        // Verify model is dirty (new model with data should be dirty)
        assert.rejects(
            () => profile.save(),
            {
                message: `Model 'TestProfile' does not implement the Persistable interface.`
            },
            'New model with data should be dirty'
        );
        
        // Revert should clear all data since there was no original state
        profile.revert();
        
        // Model should have no data after revert
        assert.strictEqual(profile.has('bio'), false, 'Should have no data after revert on new model');
        
        // Model should still be dirty and "new" after revert (back to initial new state)
        assert.rejects(
            () => profile.save(),
            {
                message: `Model 'TestProfile' does not implement the Persistable interface.`
            },
            'Should still be dirty after revert on new model (back to new state)'
        );
    });
});

describe('BaseModel: Static Schema Methods', () => {
    it('should manage schema fields with addField and getProcessedSchema', () => {
        // Create a test class to work with
        class TestStaticSchema extends TestProfile {}
        
        // Initial schema should only have the base TestProfile fields
        const initialSchema = (TestStaticSchema as any).getProcessedSchema();
        const initialFields = initialSchema.fields ?? {} as Record<string, any>;
        assert.strictEqual(Object.keys(initialFields).length, 2, 'Should start with 2 fields (bio, viewCount)');
        assert.strictEqual(typeof initialSchema.fields.bio, 'object', 'Should have bio field');
        assert.strictEqual(initialSchema.fields.viewCount.options.readOnly, true, 'Should have viewCount field');
        
        // Add a new field using addField - use correct FieldMetadata structure
        (TestStaticSchema as any).addField('newField', {
            options: {
                default: 42
            },
            type: 'number',
            description: 'A test field'
        });
        
        // Schema should now include the new field
        const updatedSchema = (TestStaticSchema as any).getProcessedSchema();
        const updatedFields = updatedSchema.fields ?? {} as Record<string, any>;
        assert.strictEqual(Object.keys(updatedFields).length, 3, 'Should now have 3 fields');
        assert.strictEqual(updatedSchema.fields.newField.type, 'number', 'Should have new field with correct type');
        assert.strictEqual(updatedSchema.fields.newField.options.default, 42, 'Should have new field with correct default');
        assert.strictEqual(updatedSchema.fields.newField.description, 'A test field', 'Should have new field with correct description');
        
        // Test setMetaValue functionality
        (TestStaticSchema as any).setMetaValue('testMeta', { value: 'test metadata' });
        
        const schemaWithMeta = (TestStaticSchema as any).getProcessedSchema();
        assert.deepStrictEqual(schemaWithMeta.meta.testMeta, { value: 'test metadata' }, 'Should include metadata in schema');
        
        // Test that schema inheritance works
        class TestChildSchema extends TestStaticSchema {}
        
        const childSchema = (TestChildSchema as any).getProcessedSchema();
        const childFields = childSchema.fields ?? {} as Record<string, any>;
        assert.strictEqual(Object.keys(childFields).length, 3, 'Child should inherit all parent fields');
        assert.strictEqual(childSchema.fields.newField.type, 'number', 'Child should inherit custom parent field');
        assert.deepStrictEqual(childSchema.meta.testMeta, { value: 'test metadata' }, 'Child should inherit parent metadata');
        
        // Add field to child - should not affect parent
        (TestChildSchema as any).addField('childField', { 
            options: { default: false },
            type: 'boolean'
        });
        
        const finalChildSchema = (TestChildSchema as any).getProcessedSchema();
        const finalParentSchema = (TestStaticSchema as any).getProcessedSchema();
        const finalChildFields = finalChildSchema.fields ?? {} as Record<string, any>;
        const finalParentFields = finalParentSchema.fields ?? {} as Record<string, any>;
        
        assert.strictEqual(Object.keys(finalChildFields).length, 4, 'Child should have 4 fields including its own');
        assert.strictEqual(Object.keys(finalParentFields).length, 3, 'Parent should still have 3 fields');
        assert.strictEqual(finalChildSchema.fields.childField.type, 'boolean', 'Child should have its own field');
        assert.strictEqual(finalParentSchema.fields.childField, undefined, 'Parent should not have child field');
    });
});

describe('BaseModel: Field Converters and Validators', () => {
    it('should apply converters during set operations', () => {
        class TestConvertModel extends BaseModel {
            @field({ 
                converter: (value: unknown): string => {
                    if (typeof value === 'number') return value.toString();
                    if (typeof value === 'string') return value.toUpperCase();
                    throw new Error('Invalid type');
                }
            })
            accessor convertedField!: string;
        }
        model(TestConvertModel);
        
        const instance = new TestConvertModel();
        
        // Test number to string conversion
        instance.set('convertedField', 42);
        assert.strictEqual(instance.get('convertedField'), '42');
        
        // Test string to uppercase conversion
        instance.set('convertedField', 'hello');
        assert.strictEqual(instance.get('convertedField'), 'HELLO');
    });

    it('should apply converters during hydration', async () => {
        class TestHydrateModel extends BaseModel {
            @field({ 
                converter: (value: unknown): number => {
                    if (typeof value === 'string') return parseInt(value, 10);
                    if (typeof value === 'number') return value;
                    throw new Error('Cannot convert to number');
                }
            })
            accessor numericField!: number;
        }
        model(TestHydrateModel);
        
        // Test hydration with string that should be converted to number
        const instance = await TestHydrateModel.fromData({ numericField: '123' as any });
        assert.strictEqual(instance.get('numericField'), 123);
        assert.strictEqual(typeof instance.get('numericField'), 'number');
    });

    it('should apply validators and reject invalid values', () => {
        class TestValidatorModel extends BaseModel {
            @field({ 
                validator: (value: string): boolean => {
                    return typeof value === 'string' && value.length > 0;
                }
            })
            accessor validatedField!: string;
        }
        model(TestValidatorModel);
        
        const instance = new TestValidatorModel();
        
        // Valid value should work
        instance.set('validatedField', 'valid');
        assert.strictEqual(instance.get('validatedField'), 'valid');
        
        // Invalid value should throw
        assert.throws(() => {
            instance.set('validatedField', '');
        }, /Validation failed for field "validatedField"/);
    });

    it('should apply validators during hydration and reject invalid data', async () => {
        class TestHydrateValidatorModel extends BaseModel {
            @field({ 
                validator: (value: number): boolean => {
                    return typeof value === 'number' && value > 0;
                }
            })
            accessor positiveNumber!: number;
        }
        model(TestHydrateValidatorModel);
        
        // Valid data should work
        const validInstance = await TestHydrateValidatorModel.fromData({ positiveNumber: 42 });
        assert.strictEqual(validInstance.get('positiveNumber'), 42);
        
        // Invalid data should throw
        await assert.rejects(
            () => TestHydrateValidatorModel.fromData({ positiveNumber: -5 }),
            /Validation failed for field "positiveNumber" during hydration/
        );
    });

    it('should apply both converter and validator in sequence', () => {
        class TestConvertAndValidateModel extends BaseModel {
            @field({ 
                converter: (value: unknown): number => {
                    if (typeof value === 'string') return parseInt(value, 10);
                    if (typeof value === 'number') return value;
                    throw new Error('Cannot convert to number');
                },
                validator: (value: number): boolean => {
                    return value >= 0 && value <= 100;
                }
            })
            accessor percentage!: number;
        }
        model(TestConvertAndValidateModel);
        
        const instance = new TestConvertAndValidateModel();
        
        // Valid string that converts to valid number
        instance.set('percentage', '50');
        assert.strictEqual(instance.get('percentage'), 50);
        
        // Valid number
        instance.set('percentage', 75);
        assert.strictEqual(instance.get('percentage'), 75);
        
        // String that converts to invalid number
        assert.throws(() => {
            instance.set('percentage', '150');
        }, /Validation failed for field "percentage"/);
        
        // Invalid number directly
        assert.throws(() => {
            instance.set('percentage', -10);
        }, /Validation failed for field "percentage"/);
    });

    it('should handle converter errors gracefully', () => {
        class TestConverterErrorModel extends BaseModel {
            @field({ 
                converter: (value: unknown): string => {
                    if (typeof value === 'string') return value;
                    throw new Error('Only strings allowed');
                }
            })
            accessor stringField!: string;
        }
        model(TestConverterErrorModel);
        
        const instance = new TestConverterErrorModel();
        
        // Valid value should work
        instance.set('stringField', 'hello');
        assert.strictEqual(instance.get('stringField'), 'hello');
        
        // Invalid value should propagate converter error
        assert.throws(() => {
            instance.set('stringField', 123);
        }, /Only strings allowed/);
    });

    it('should not mark model dirty when converter returns same value', () => {
        class TestDirtyModel extends BaseModel {
            @field({ 
                converter: (value: unknown): string => {
                    if (typeof value === 'string') return value.trim();
                    return String(value);
                }
            })
            accessor trimmedField!: string;
        }
        model(TestDirtyModel);
        
        const instance = new TestDirtyModel();
        
        // Simulate a loaded model with existing data by hydrating
        (instance as any).hydrate({ trimmedField: 'hello' });
        
        // Verify the model is not dirty after hydration
        assert.strictEqual((instance as any).dirty, false, 'Should not be dirty after hydration');
        
        // Setting a value that converts to the same result should not mark dirty
        instance.set('trimmedField', ' hello '); 
        assert.strictEqual((instance as any).dirty, false, 'Should not be dirty when converter returns same value');
        
        // Setting a value that converts to different result should mark dirty
        instance.set('trimmedField', ' world ');
        assert.strictEqual((instance as any).dirty, true, 'Should be dirty when converter returns different value');
    });
});
