import { test } from 'node:test';
import * as assert from 'node:assert';

import { BaseTemplate } from '../../../src/modules/templates/baseTemplate.js';
import { BaseTemplates } from '../../../src/modules/templates/baseTemplates.js';
import { TemplateResult } from '../../../src/modules/templates/engine/templateResult.js';
import { html } from '../../../src/modules/templates/engine/html.js';
import { Tag } from '../../../src/modules/templates/engine/tag.js';
import { type BaseLogger } from '../../../src/core/logger/baseLogger.js';
import { type BaseTemplatesConfig } from '../../../src/modules/templates/types.js';
import { getModuleWithMocks } from '../../testUtils/utils.js';
import { BaseDi } from '../../../src/core/di/baseDi.js';
import { IfTag } from '../../../src/modules/templates/engine/tags/ifTag.js';
import { EachTag } from '../../../src/modules/templates/engine/tags/eachTag.js';

// Test tag for testing tag access
class TestTag extends Tag {
  readonly name = 'test';
  
  async render(): Promise<string> {
    return `test-${String(this.value)}`;
  }
}

// Test template for testing template access
class TestTemplate extends BaseTemplate<{ message: string }> {
  render(): TemplateResult {
    return html`Message: ${this.data.message}`;
  }
}

// Test implementation of BaseTemplate
class UserTemplate extends BaseTemplate<{ name: string; age: number, messages: string[] }> {
  render(): TemplateResult {
        return html`User ${this.data.name}(${this.data.age})||${this.tags.if(this.data.age >= 18, { then: html`Adult`, else: html`Minor` })}||${this.tags.each(this.data.messages, { do: (message) => html` * ${message}` })}`;
  }
}

// Type for test BaseTemplates instance
type TestBaseTemplates = BaseTemplates & { 
  testLogger: BaseLogger; 
  testConfig: BaseTemplatesConfig; 
};

// Create a testable BaseTemplates instance
const CREATE_TEMPLATES_INSTANCE = (): TestBaseTemplates => {
  const { module, logger, config } = getModuleWithMocks<BaseTemplatesConfig, BaseTemplates>(
    'BaseTemplates', 
    () => new BaseTemplates()
  );
  
  (module as TestBaseTemplates).testLogger = logger;
  (module as TestBaseTemplates).testConfig = config;
  
  return module as TestBaseTemplates;
};

test('BaseTemplate constructor', (t) => {

  t.test('should store data correctly', async () => {
    // Setup BaseTemplates and required tags for UserTemplate
    const templatesInstance = CREATE_TEMPLATES_INSTANCE();
    BaseDi.register(templatesInstance, { key: 'BaseTemplates', singleton: true });
    
    // Register mock IfTag
    class MockIfTag extends Tag {
      readonly name = 'if';
      async render(): Promise<string> {
        return 'mock-if-result';
      }
    }
    
    const mockIfTag = new MockIfTag('if');
    BaseDi.register(mockIfTag, { key: 'TemplateTag.if', tags: new Set(['Template:Tag']), singleton: false });
    
    // Register mock TestTemplate
    BaseDi.register(TestTemplate, { key: 'Template.TestTemplate', tags: new Set(['Template']), singleton: false });
    
    const data = { name: 'John', age: 30, messages: ['Hello', 'World'] };
    const template = new UserTemplate(data);
    
    assert.deepStrictEqual((template as any).data, data);
  });

  t.test('should handle different data types', () => {
    const stringData = 'test string';
    const numberData = 42;
    const objectData = { complex: { nested: 'value' } };
    
    class StringTemplate extends BaseTemplate<string> {
      render(): TemplateResult {
        return html`${this.data}`;
      }
    }
    
    class NumberTemplate extends BaseTemplate<number> {
      render(): TemplateResult {
        return html`${this.data}`;
      }
    }
    
    class ObjectTemplate extends BaseTemplate<{ complex: { nested: string } }> {
      render(): TemplateResult {
        return html`${this.data.complex.nested}`;
      }
    }
    
    const stringTemplate = new StringTemplate(stringData);
    const numberTemplate = new NumberTemplate(numberData);
    const objectTemplate = new ObjectTemplate(objectData);
    
    assert.strictEqual((stringTemplate as any).data, stringData);
    assert.strictEqual((numberTemplate as any).data, numberData);
    assert.deepStrictEqual((objectTemplate as any).data, objectData);
  });
});

test('BaseTemplate tags property', (t) => {

  t.test('should expose tagFactories from BaseTemplates', async () => {
    const templatesInstance = CREATE_TEMPLATES_INSTANCE();
    
    // Register BaseTemplates instance with DI
    BaseDi.register(templatesInstance, { key: 'BaseTemplates', singleton: true });
    
    // Register a test tag
    const testTag = new TestTag('test');
    BaseDi.register(testTag, { key: 'TemplateTag.test', tags: new Set(['Template:Tag']), singleton: false });
    
    await templatesInstance.setup();
    
    // Create template instance
    const template = new UserTemplate({ name: 'John', age: 30, messages: ['Hello', 'World'] });
    
    const tags = template.tags;
    
    // Should have the test tag factory
    assert.ok((tags as any).test);
    assert.strictEqual(typeof (tags as any).test, 'function');
    
    // Should be able to create tag instances
    const tagInstance = (tags as any).test('value', {});
    assert.ok(tagInstance instanceof TestTag);
  });

  t.test('should return empty object when BaseTemplates not set up', () => {
    // Create a BaseTemplates instance but don't set it up
    const templatesInstance = CREATE_TEMPLATES_INSTANCE();
    
    // Register BaseTemplates instance with DI but don't call setup
    BaseDi.register(templatesInstance, { key: 'BaseTemplates', singleton: true });
    
    const template = new UserTemplate({ name: 'John', age: 30, messages: ['Hello', 'World'] });
    
    // Without setup, should return empty factories
    const tags = template.tags;
    assert.deepStrictEqual(Object.keys(tags), []);
  });
});

test('BaseTemplate templates property', (t) => {

  t.test('should expose templateFactories from BaseTemplates', async () => {
    const templatesInstance = CREATE_TEMPLATES_INSTANCE();
    
    // Register BaseTemplates instance with DI
    BaseDi.register(templatesInstance, { key: 'BaseTemplates', singleton: true });
    
    // Register a test template
    const testTemplate = new TestTemplate({ message: 'test' });
    BaseDi.register(testTemplate, { key: 'Template.TestTemplate', tags: new Set(['Template']), singleton: false });
    
    await templatesInstance.setup();
    
    // Create template instance
    const template = new UserTemplate({ name: 'John', age: 30, messages: ['Hello', 'World'] });
    
    const templates = template.templates;
    
    // Should have the test template factory
    assert.ok((templates as any).TestTemplate);
    assert.strictEqual(typeof (templates as any).TestTemplate, 'function');
    
    // Should be able to create template results
    const templateResult = (templates as any).TestTemplate({ message: 'Hello' });
    assert.ok(templateResult instanceof TemplateResult);
  });

  t.test('should return empty object when BaseTemplates not set up', async () => {
    // Create a BaseTemplates instance but don't set it up
    const templatesInstance = CREATE_TEMPLATES_INSTANCE();
    
    // Register BaseTemplates instance with DI but don't call setup
    BaseDi.register(templatesInstance, { key: 'BaseTemplates', singleton: true });
    
    const template = new UserTemplate({ name: 'John', age: 30, messages: ['Hello', 'World'] });
    
    // Without setup, should return empty factories
    const templates = template.templates;
    assert.deepStrictEqual(Object.keys(templates), []);
  });
});

test('BaseTemplate abstract render method', (t) => {

  t.test('should require implementation in subclass', async () => {
    const templatesInstance = CREATE_TEMPLATES_INSTANCE();
    BaseDi.register(templatesInstance, { key: 'BaseTemplates', singleton: true });
    
    BaseDi.register(IfTag, { key: 'TemplateTag.if', tags: new Set(['Template:Tag']), singleton: false });
    BaseDi.register(EachTag, { key: 'TemplateTag.each', tags: new Set(['Template:Tag']), singleton: false });
    
    await templatesInstance.setup();

    const template = new UserTemplate({ name: 'John', age: 30, messages: ['Hello', 'World'] });
    const result = template.render();
    
    assert.strictEqual(await result.render(), "User John(30)||Adult|| * Hello * World");
  });
  
});
