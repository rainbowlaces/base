import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { field } from '../../../src/core/models/decorators/field.js';
import { model } from '../../../src/core/models/decorators/model.js';
import { BaseIdentifiableModel } from '../../../src/core/models/baseIdentifiableModel.js';
import { type ModelData } from '../../../src/core/models/types.js';
import { setupTestTeardown } from './setup.js';

// Setup test isolation
setupTestTeardown();

// Test models
@model
class TestArticle extends BaseIdentifiableModel {
    @field()
    accessor title!: string;

    @field()
    accessor public!: boolean;
}

@model
class TestArticleVersion extends BaseIdentifiableModel {
    @field()
    accessor title!: string;

    @field()
    accessor summary!: string;

    @field()
    accessor status!: string;

    @field()
    accessor article!: string;
}

describe('Event Handler Data Access', () => {
    
    it('should serialize model data correctly', async () => {
        const article = new TestArticle();
        article.set('title', 'Test Article');
        article.set('public', true);

        const articleVersion = new TestArticleVersion();
        articleVersion.set('title', 'Version Title');
        articleVersion.set('summary', 'Version Summary');
        articleVersion.set('status', 'draft');
        articleVersion.set('article', article.id.toString());

        const eventData: ModelData<TestArticleVersion> = articleVersion.serialize();

        assert.strictEqual(eventData.title, 'Version Title');
        assert.strictEqual(eventData.summary, 'Version Summary');
        assert.strictEqual(eventData.status, 'draft');
        assert.strictEqual(eventData.article, article.id.toString());
    });

    it('should reconstruct models from serialized data', async () => {
        const article = new TestArticle();
        article.set('title', 'Test Article');
        article.set('public', true);

        const articleVersion = new TestArticleVersion();
        articleVersion.set('title', 'Version Title');
        articleVersion.set('summary', 'Version Summary');
        articleVersion.set('status', 'draft');
        articleVersion.set('article', article.id.toString());

        const eventData: ModelData<TestArticleVersion> = articleVersion.serialize();
        const modelInstance = await TestArticleVersion.fromData(eventData);
        
        assert.strictEqual(modelInstance.get('title'), 'Version Title');
        assert.strictEqual(modelInstance.get('summary'), 'Version Summary');
        assert.strictEqual(modelInstance.get('status'), 'draft');
    });
});
