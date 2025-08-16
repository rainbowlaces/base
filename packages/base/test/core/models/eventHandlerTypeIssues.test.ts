import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { field } from '../../../src/core/models/decorators/field.js';
import { derived } from '../../../src/core/models/decorators/derived.js';
import { model } from '../../../src/core/models/decorators/model.js';
import { BaseIdentifiableModel } from '../../../src/core/models/baseIdentifiableModel.js';
import { type Derived, type ModelData, type NoDerivedModelData, type ModelEvent } from '../../../src/core/models/types.js';
import { type BasePubSubArgs } from '../../../src/core/pubsub/types.js';
import { setupTestTeardown } from './setup.js';
import { UniqueID } from '../../../src/core/models/uniqueId.js';

// Setup test isolation
setupTestTeardown();

// Test models that mirror the Article/ArticleVersion pattern from the user's code
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
    accessor article!: string; // Store as string ID instead of reference for simplicity

    @derived()
    async computedTitle(): Derived<Promise<string>> {
        const title = this.get('title') as string;
        return `Computed: ${title}`;
    }

    @derived()
    async isMissing(): Derived<Promise<boolean>> {
        // Simulate some async check
        return false;
    }
}

describe('Event Handler Type Issues - Real World Scenario', () => {
    
    it('should demonstrate the casting issue from user code', async () => {
        // Create test data similar to the user's scenario
        const article = new TestArticle();
        article.set('title', 'Test Article');
        article.set('public', true);

        const articleVersion = new TestArticleVersion();
        articleVersion.set('title', 'Version Title');
        articleVersion.set('summary', 'Version Summary');
        articleVersion.set('status', 'draft');
        articleVersion.set('article', article.id.toString());

        // Simulate what happens in an event handler
        const eventData: NoDerivedModelData<TestArticleVersion> = articleVersion.serialize();

        console.log('Event data received:', eventData);
        console.log('Event data keys:', Object.keys(eventData));

        // This is what the user's code does - PROBLEMATIC CASTING
        const wrongCast = eventData as unknown as ModelData<TestArticleVersion>;
        
        // This should work - accessing regular fields
        assert.strictEqual(wrongCast.title, 'Version Title');
        assert.strictEqual(wrongCast.summary, 'Version Summary');
        assert.strictEqual(wrongCast.status, 'draft');
        
        // The problem: trying to access derived fields
        // These will be undefined at runtime but TypeScript thinks they exist!
        console.log('computedTitle (should be undefined):', wrongCast.computedTitle);
        console.log('isMissing (should be undefined):', wrongCast.isMissing);
        
        // At runtime, these are undefined even though TypeScript allows access
        assert.strictEqual(wrongCast.computedTitle, undefined);
        assert.strictEqual(wrongCast.isMissing, undefined);
        
        // The article field should work fine since it's a regular field
        console.log('article field value:', wrongCast.article);
        assert.strictEqual(wrongCast.article, article.id.toString());
    });

    it('should show the correct way to handle event data', async () => {
        const article = new TestArticle();
        article.set('title', 'Test Article');
        article.set('public', true);

        const articleVersion = new TestArticleVersion();
        articleVersion.set('title', 'Version Title');
        articleVersion.set('summary', 'Version Summary');
        articleVersion.set('status', 'draft');
        articleVersion.set('article', article.id.toString());

        // Simulate event handler receiving data
        const eventData: NoDerivedModelData<TestArticleVersion> = articleVersion.serialize();

        // CORRECT: Don't cast to ModelData, work with NoDerivedModelData
        assert.strictEqual(eventData.title, 'Version Title');
        assert.strictEqual(eventData.summary, 'Version Summary');
        assert.strictEqual(eventData.status, 'draft');
        
        // CORRECT: If you need derived data, create a model instance and call derive()
        const modelInstance = await TestArticleVersion.fromData(eventData);
        const fullData = await modelInstance.derive();
        
        // Now we can access derived fields
        assert.strictEqual(fullData.computedTitle, 'Computed: Version Title');
        assert.strictEqual(fullData.isMissing, false);
        
        console.log('Correct approach - full derived data:', fullData);
    });

    it('should demonstrate the specific issue from user code', async () => {
        const article = new TestArticle();
        article.set('title', 'Test Article');
        article.set('public', true);

        const articleVersion = new TestArticleVersion();
        articleVersion.set('title', 'Version Title');
        articleVersion.set('summary', 'Version Summary');
        articleVersion.set('status', 'draft');
        articleVersion.set('article', article.id.toString());

        // Simulate the event handler
        const simulateEventHandler = (args: BasePubSubArgs & { event: ModelEvent<TestArticleVersion> }) => {
            const eventData = args;
            if (!eventData.event) return;

            const data = eventData.event.data; // This is NoDerivedModelData<TestArticleVersion>

            // The user's code that should work fine:
            const lockKey = `articleEvent:${data.article ?? ""}`;
            
            // This should work because 'article' is a regular field (not derived)
            console.log('Lock key generated:', lockKey);
            assert(lockKey.includes('articleEvent:'));
            
            // The problem comes from this cast:
            const articleVersionData = eventData.event.data as unknown as ModelData<TestArticleVersion>;
            
            // If the user tries to access derived fields, they'll get undefined
            console.log('Derived field access (undefined):', articleVersionData.computedTitle);
            assert.strictEqual(articleVersionData.computedTitle, undefined);
            
            // But regular fields work fine
            assert.strictEqual(articleVersionData.title, 'Version Title');
        };

        // Create mock event
        const mockEvent: ModelEvent<TestArticleVersion> = {
            id: new UniqueID(),
            type: 'create',
            model: articleVersion,
            data: articleVersion.serialize()
        };

        const mockArgs: BasePubSubArgs & { event: ModelEvent<TestArticleVersion> } = {
            topic: '/models/create/test-article-version',
            event: mockEvent
        };

        simulateEventHandler(mockArgs);
    });

    it('should show TypeScript limitations with unsafe casting', () => {
        const articleVersion = new TestArticleVersion();
        articleVersion.set('title', 'Version Title');
        articleVersion.set('summary', 'Version Summary');
        articleVersion.set('status', 'draft');

        const serialized: NoDerivedModelData<TestArticleVersion> = articleVersion.serialize();
        
        // This unsafe cast makes TypeScript think derived fields exist
        const unsafeCast = serialized as unknown as ModelData<TestArticleVersion>;
        
        // TypeScript allows this access, but at runtime it's undefined
        // The user might expect this to work based on the type, but it doesn't
        
        // This compiles but fails at runtime:
        const shouldBeUndefined = unsafeCast.computedTitle;
        assert.strictEqual(shouldBeUndefined, undefined);
        
        console.log('TypeScript thinks derived fields exist, but they don\'t at runtime');
        console.log('This is the root of the user\'s "weird behavior"');
    });

    it('should demonstrate the fix: proper type usage', () => {
        const articleVersion = new TestArticleVersion();
        articleVersion.set('title', 'Version Title');
        articleVersion.set('summary', 'Version Summary');
        articleVersion.set('status', 'draft');

        // Simulate event data (what actually comes in events)
        const eventData: NoDerivedModelData<TestArticleVersion> = articleVersion.serialize();
        
        // WRONG: Don't cast to ModelData
        // const wrongCast = eventData as unknown as ModelData<TestArticleVersion>;
        
        // RIGHT: Use the data as NoDerivedModelData
        const data: NoDerivedModelData<TestArticleVersion> = eventData;
        
        // Access regular fields safely
        assert.strictEqual(data.title, 'Version Title');
        assert.strictEqual(data.summary, 'Version Summary');
        assert.strictEqual(data.status, 'draft');
        
        // TypeScript correctly prevents access to derived fields
        // data.computedTitle; // This would be a TypeScript error
        // data.isMissing; // This would be a TypeScript error
        
        console.log('Proper typing prevents accessing non-existent derived fields');
    });
});
