/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { setupTestTeardown, TestProfile, type MockPubSub } from './setup';
import { BaseDi } from '../../../src/core/di/baseDi';
import type { Persistable, Deletable } from '../../../src/core/models/types';

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
        
        // Test that get throws for readonly field that has no value
        assert.throws(() => profile.get('viewCount'), /Field "viewCount" is not set/, 'Should throw when getting unset readonly field');
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
    
    it('should serialise model data correctly', () => {
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
        const hydratedData = { bio: 'Original bio', extraField: 'ignored' };
        const hydratedProfile = new TestProfile();
        (hydratedProfile as any).hydrate(hydratedData);
        
        const hydratedSerialized = hydratedProfile.serialise();
        // Should only serialize fields that are in the schema and set
        assert.deepStrictEqual(hydratedSerialized, { bio: 'Original bio' }, 'Should only serialize schema fields that are set');
        assert.strictEqual(Object.hasOwnProperty.call(hydratedSerialized, 'extraField'), false, 'Should ignore non-schema fields during serialization');
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
