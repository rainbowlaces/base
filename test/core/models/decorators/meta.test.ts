 

import { describe, it, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { BaseModel } from '../../../../src/core/models/baseModel.js';
import { meta } from '../../../../src/core/models/decorators/meta.js';
import { setupTestTeardown } from '../setup.js';

// For testing, extend the ModelMetadata interface
declare module '../../../../src/core/models/types.js' {
    interface ModelMetadata {
        testKey?: string;
        source?: string;
        version?: number;
        mongo?: { collection: string; indexes: string[] };
        config?: () => { dynamic: boolean };
        author?: string;
        tags?: string[];
        environment?: string;
    }
}

// Setup test isolation
setupTestTeardown();

describe('@meta decorator', () => {
    it('should call BaseModel.setMetaValue with the correct key and value', () => {
        class TestModel extends BaseModel {
            // Static method will be called during decoration
        }

        // Spy on setMetaValue using type assertion to access private method
        const setMetaValueSpy = test.mock.method(TestModel as any, 'setMetaValue');

        // Apply the @meta decorator with a test key/value
        const metaDecorator = meta('testKey', 'testValue');
        metaDecorator(TestModel, {} as ClassDecoratorContext);

        // Should have called setMetaValue with correct arguments
        assert.strictEqual(setMetaValueSpy.mock.callCount(), 1);
        assert.strictEqual(setMetaValueSpy.mock.calls[0]?.arguments[0], 'testKey');
        assert.strictEqual(setMetaValueSpy.mock.calls[0]?.arguments[1], 'testValue');
    });

    it('should correctly add the metadata to the processed schema', () => {
        class TestModel extends BaseModel {
            // Empty model for testing metadata
        }

        // Apply multiple @meta decorators
        const metaDecorator1 = meta('source', 'database');
        const metaDecorator2 = meta('version', 1);

        metaDecorator1(TestModel, {} as ClassDecoratorContext);
        metaDecorator2(TestModel, {} as ClassDecoratorContext);

        // Get the processed schema
        const schema = (TestModel as typeof BaseModel).getProcessedSchema();

        // Should contain the metadata
        assert.strictEqual(schema.meta.source, 'database');
        assert.strictEqual(schema.meta.version, 1);
    });

    it('should work with object values', () => {
        class TestModel extends BaseModel {
            // Empty model for testing
        }

        const complexValue = { collection: 'users', indexes: ['email', 'name'] };
        const metaDecorator = meta('mongo', complexValue);
        metaDecorator(TestModel, {} as ClassDecoratorContext);

        const schema = (TestModel as typeof BaseModel).getProcessedSchema();
        assert.deepStrictEqual(schema.meta.mongo, complexValue);
    });

    it('should work with function values', () => {
        class TestModel extends BaseModel {
            // Empty model for testing
        }

        const configFunction = () => ({ dynamic: true });
        const metaDecorator = meta('config', configFunction);
        metaDecorator(TestModel, {} as ClassDecoratorContext);

        const schema = (TestModel as typeof BaseModel).getProcessedSchema();
        assert.strictEqual(schema.meta.config, configFunction);
    });

    it('should support multiple metadata keys on the same class', () => {
        class TestModel extends BaseModel {
            // Empty model for testing
        }

        // Apply multiple different metadata decorators
        const decorators = [
            meta('source', 'api'),
            meta('version', 2),
            meta('author', 'test-user'),
            meta('tags', ['model', 'user-data'])
        ];

        decorators.forEach(decorator => {
            decorator(TestModel, {} as ClassDecoratorContext);
        });

        const schema = (TestModel as typeof BaseModel).getProcessedSchema();
        
        assert.strictEqual(schema.meta.source, 'api');
        assert.strictEqual(schema.meta.version, 2);
        assert.strictEqual(schema.meta.author, 'test-user');
        assert.deepStrictEqual(schema.meta.tags, ['model', 'user-data']);
    });

    it('should allow overriding metadata values', () => {
        class TestModel extends BaseModel {
            // Empty model for testing
        }

        // Apply same key multiple times
        const decorator1 = meta('environment', 'development');
        const decorator2 = meta('environment', 'production');

        decorator1(TestModel, {} as ClassDecoratorContext);
        decorator2(TestModel, {} as ClassDecoratorContext);

        const schema = (TestModel as typeof BaseModel).getProcessedSchema();
        
        // Should have the last value
        assert.strictEqual(schema.meta.environment, 'production');
    });

    it('should work with inheritance - child class can have its own metadata', () => {
        class ParentModel extends BaseModel {
            // Parent model
        }

        class ChildModel extends ParentModel {
            // Child model
        }

        // Add metadata to both parent and child
        const parentDecorator = meta('source', 'parent');
        const childDecorator = meta('source', 'child');

        parentDecorator(ParentModel, {} as ClassDecoratorContext);
        childDecorator(ChildModel, {} as ClassDecoratorContext);

        // Each should have its own metadata
        const parentSchema = (ParentModel as typeof BaseModel).getProcessedSchema();
        const childSchema = (ChildModel as typeof BaseModel).getProcessedSchema();

        assert.strictEqual(parentSchema.meta.source, 'parent');
        assert.strictEqual(childSchema.meta.source, 'child');
    });
});
