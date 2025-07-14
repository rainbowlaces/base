import { test } from 'node:test';
import * as assert from 'node:assert';

import { BaseTemplates } from '../../../src/modules/templates/baseTemplates.js';
import { Tag } from '../../../src/modules/templates/engine/tag.js';
import { BaseTemplate } from '../../../src/modules/templates/baseTemplate.js';
import { TemplateResult } from '../../../src/modules/templates/engine/templateResult.js';
import { html } from '../../../src/modules/templates/engine/html.js';
import { type BaseLogger } from '../../../src/core/logger/baseLogger.js';
import { type BaseTemplatesConfig } from '../../../src/modules/templates/types.js';
import { getModuleWithMocks } from '../../testUtils/utils.js';
import { BaseDi } from '../../../src/core/di/baseDi.js';

// Test tag implementation
class TestTag extends Tag {
  readonly name = 'test';
  
  async render(): Promise<string> {
    return `test-${String(this.value)}`;
  }
}

// Another test tag
class AnotherTag extends Tag {
  readonly name = 'another';
  
  async render(): Promise<string> {
    return `another-${String(this.value)}`;
  }
}

// Test template implementation
class TestTemplate extends BaseTemplate<{ message: string }> {
  render(): TemplateResult {
    return html`Message: ${this.data.message}`;
  }
}

// Another test template
class UserTemplate extends BaseTemplate<{ name: string; email: string }> {
  render(): TemplateResult {
    return html`User: ${this.data.name} (${this.data.email})`;
  }
}

// Type for test instance with additional test properties
type TestBaseTemplates = BaseTemplates & { 
  testLogger: BaseLogger; 
  testConfig: BaseTemplatesConfig; 
};

// Create a testable BaseTemplates instance using getModuleWithMocks
const CREATE_TEST_INSTANCE = (configOverrides: Record<string, unknown> = {}): TestBaseTemplates => {
  const { module, logger, config } = getModuleWithMocks<BaseTemplatesConfig, BaseTemplates>(
    'BaseTemplates', 
    () => new BaseTemplates()
  );
  
  // Apply config overrides
  Object.assign(config, configOverrides);
  
  // Store references for test access
  (module as TestBaseTemplates).testLogger = logger;
  (module as TestBaseTemplates).testConfig = config;
  
  return module as TestBaseTemplates;
};

test('BaseTemplates setup() method', (t) => {

  t.test('should build tagFactories from DI registry', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    // Manually register tag classes with DI
    BaseDi.register(TestTag, { key: 'TemplateTag.test', tags: new Set(['Template:Tag']), singleton: false });
    BaseDi.register(AnotherTag, { key: 'TemplateTag.another', tags: new Set(['Template:Tag']), singleton: false });
    
    await instance.setup();
    
    // Test actual behavior: factories should be created and work
    assert.ok((instance.tagFactories as any).test);
    assert.ok((instance.tagFactories as any).another);
    
    // Test that factories create working tag instances
    const testFactory = (instance.tagFactories as any).test;
    const testInstance = testFactory('value', {});
    assert.ok(testInstance instanceof TestTag);
    assert.strictEqual(await testInstance.render(), 'test-value');
    
    const anotherFactory = (instance.tagFactories as any).another;
    const anotherInstance = anotherFactory('value', {});
    assert.ok(anotherInstance instanceof AnotherTag);
    assert.strictEqual(await anotherInstance.render(), 'another-value');
  });

  t.test('should build templateFactories from DI registry', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    // Register test template classes for discovery
    BaseDi.register(TestTemplate, { key: 'Template.TestTemplate', tags: new Set(['Template']), singleton: false });
    BaseDi.register(UserTemplate, { key: 'Template.UserTemplate', tags: new Set(['Template']), singleton: false });
    
    await instance.setup();
    
    // Test actual behavior: factories should be created and work
    assert.ok((instance.templateFactories as any).TestTemplate);
    assert.ok((instance.templateFactories as any).UserTemplate);
    
    // Test that factories create working template instances
    const testFactory = (instance.templateFactories as any).TestTemplate;
    const testResult = testFactory({ message: 'test data' });
    assert.ok(testResult instanceof TemplateResult);
    assert.strictEqual(await testResult.render(), 'Message: test data');
    
    const userFactory = (instance.templateFactories as any).UserTemplate;
    const userResult = userFactory({ name: 'Test', email: 'test@example.com' });
    assert.ok(userResult instanceof TemplateResult);
    assert.strictEqual(await userResult.render(), 'User: Test (test@example.com)');
  });

  t.test('should handle empty registries gracefully', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    // Don't register anything - test empty registries
    
    await instance.setup();
    
    // Test actual behavior: should have empty factories objects
    assert.deepStrictEqual(Object.keys(instance.tagFactories), []);
    assert.deepStrictEqual(Object.keys(instance.templateFactories), []);
  });

  t.test('should register tags and templates correctly', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    // Register classes manually 
    BaseDi.register(TestTag, { key: 'TemplateTag.test', tags: new Set(['Template:Tag']), singleton: false });
    BaseDi.register(TestTemplate, { key: 'Template.TestTemplate', tags: new Set(['Template']), singleton: false });
    
    await instance.setup();
    
    // Test actual behavior: factories should be created and work
    assert.ok((instance.tagFactories as any).test);
    assert.ok((instance.templateFactories as any).TestTemplate);
    
    // Test that tag factory works
    const tagFactory = (instance.tagFactories as any).test;
    const tagInstance = tagFactory('value', {});
    assert.ok(tagInstance instanceof TestTag);
    assert.strictEqual(await tagInstance.render(), 'test-value');
    
    // Test that template factory works
    const templateFactory = (instance.templateFactories as any).TestTemplate;
    const result = templateFactory({ message: 'hello' });
    assert.ok(result instanceof TemplateResult);
    assert.strictEqual(await result.render(), 'Message: hello');
  });
});
