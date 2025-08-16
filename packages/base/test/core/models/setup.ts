import { test } from 'node:test';
import { BaseModel } from '../../../src/core/models/baseModel.js';
import { BaseIdentifiableModel } from '../../../src/core/models/baseIdentifiableModel.js';
import { field } from '../../../src/core/models/decorators/field.js';
import { model } from '../../../src/core/models/decorators/model.js';
import { reference } from '../../../src/core/models/decorators/reference.js';
import { embed } from '../../../src/core/models/decorators/embed.js';
import { type Persistable, type Deletable, type ModelData, type RefOne, type EmbedMany } from '../../../src/core/models/types.js';
import { UniqueID } from '../../../src/core/models/uniqueId.js';
import { BaseDi } from '../../../src/core/di/baseDi.js';

// Mock models for testing
export class TestUser extends BaseIdentifiableModel implements Persistable, Deletable {
    @field()
    accessor name!: string;

    @field()
    accessor email!: string;

    @field({ default: () => new Date() })
    accessor createdAt!: Date;

    async persist(): Promise<void> {
        // Mock persistence - just mark as persisted
        (this as any).persistCalled = true;
    }

    async delete(): Promise<void> {
        // Mock deletion
        (this as any).deleteCalled = true;
    }
}

export class TestProfile extends BaseModel {
    @field()
    accessor bio!: string;

    @field({ readOnly: true })
    accessor viewCount!: number;
}

export class TestComment extends BaseModel {
    @field()
    accessor content!: string;

    @field({ default: () => new Date() })
    accessor timestamp!: Date;
}

export class TestAdmin extends TestUser {
    @field()
    accessor permissions!: string[];

    @field({ default: () => 'admin' })
    accessor role!: string;
}

export class TestPost extends BaseIdentifiableModel {
    @field()
    accessor title!: string;

    @reference(TestUser, { cardinality: 'one' })
    accessor author!: RefOne<TestUser>;

    @embed(TestComment, { cardinality: 'many' })
    accessor comments!: EmbedMany<TestComment>;
}

// Apply @model decorator to all test classes
model(TestUser);
model(TestProfile);
model(TestComment);
model(TestAdmin);
model(TestPost);

// Mock PubSub for testing
export class MockPubSub {
    public publishedEvents: { topic: string; data: any }[] = [];

    async pub(topic: string, data: any): Promise<void> {
        this.publishedEvents.push({ topic, data });
    }

    clearEvents(): void {
        this.publishedEvents = [];
    }
}

// Test utilities
export function createMockAsyncGenerator<T>(data: T[]): AsyncGenerator<T> {
    return (async function* () {
        for (const item of data) {
            yield item;
        }
    })();
}

export function createMockSyncIterable<T>(data: T[]): Iterable<T> {
    return {
        *[Symbol.iterator]() {
            for (const item of data) {
                yield item;
            }
        }
    };
}

// Global test teardown utility
export function setupTestTeardown() {
    test.beforeEach(() => {
        // Register mock PubSub in DI for BaseModel tests
        BaseDi.register(new MockPubSub(), 'BasePubSub');
    });
    
    test.afterEach(() => {
        // Clear any static state on BaseModel
        clearModelSchemas();
        
        // Restore all mocks
        test.mock.restoreAll();
        
        // Clear DI registrations
        BaseDi.teardown();
    });
}

// Helper to clear model schemas for test isolation
function clearModelSchemas() {
    const models = [TestUser, TestProfile, TestComment, TestAdmin, TestPost];
    
    for (const model of models) {
        // Access the private schema key and delete it to force fresh schemas
        const schemaKey = Symbol.for('modelSchema');
        if (schemaKey in model) {
             
            delete (model as any)[schemaKey];
        }
    }
}

// Sample data for tests
export const SAMPLE_USER_DATA: ModelData<TestUser> = {
    id: new UniqueID(),
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date('2023-01-01')
};

export const SAMPLE_PROFILE_DATA: ModelData<TestProfile> = {
    bio: 'Software developer',
    viewCount: 100
};

export const SAMPLE_COMMENT_DATA: ModelData<TestComment> = {
    content: 'Great post!',
    timestamp: new Date('2023-01-02')
};
