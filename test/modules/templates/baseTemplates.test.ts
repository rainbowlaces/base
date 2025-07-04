import { test } from 'node:test';
import * as assert from 'node:assert';

import { BaseTemplates } from '../../../src/modules/templates/baseTemplates';
import { Tag } from '../../../src/modules/templates/engine/tag';
import { BaseTemplate } from '../../../src/modules/templates/baseTemplate';
import { TemplateResult } from '../../../src/modules/templates/engine/templateResult';
import { html } from '../../../src/modules/templates/engine/html';
import { type BaseLogger } from '../../../src/core/logger/baseLogger';
import { type BaseTemplatesConfig } from '../../../src/modules/templates/types';
import { getModuleWithMocks } from '../../testUtils/utils';
import { BaseDi } from '../../../src/core/di/baseDi';

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
    
    // Register test tag instances for discovery
    const testTag = new TestTag('test');
    const anotherTag = new AnotherTag('test');
    
    BaseDi.register(testTag, { key: 'TemplateTag.test', tags: new Set(['Template:Tag']), singleton: false });
    BaseDi.register(anotherTag, { key: 'TemplateTag.another', tags: new Set(['Template:Tag']), singleton: false });
    
    await instance.setup();
    
    // Should have built tag factories
    assert.ok((instance.tagFactories as any).test);
    assert.ok((instance.tagFactories as any).another);
    
    // Test that factories work
    const testFactory = (instance.tagFactories as any).test;
    const testInstance = testFactory('value', {});
    assert.ok(testInstance instanceof TestTag);
    
    const anotherFactory = (instance.tagFactories as any).another;
    const anotherInstance = anotherFactory('value', {});
    assert.ok(anotherInstance instanceof AnotherTag);
    
    // Should log info about tag building
    const logger = instance.testLogger;
    assert.ok((logger.info as any).mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes('Building template tag factories')
    ));
    assert.ok((logger.info as any).mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes('Successfully built 2 tag factories')
    ));
  });

  t.test('should build templateFactories from DI registry', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    // Register test template instances for discovery
    const testTemplate = new TestTemplate({ message: 'test' });
    const userTemplate = new UserTemplate({ name: 'John', email: 'john@test.com' });
    
    BaseDi.register(testTemplate, { key: 'Template.TestTemplate', tags: new Set(['Template']), singleton: false });
    BaseDi.register(userTemplate, { key: 'Template.UserTemplate', tags: new Set(['Template']), singleton: false });
    
    await instance.setup();
    
    // Should have built template factories
    assert.ok((instance.templateFactories as any).TestTemplate);
    assert.ok((instance.templateFactories as any).UserTemplate);
    
    // Test that factories work and return TemplateResult
    const testFactory = (instance.templateFactories as any).TestTemplate;
    const testResult = testFactory({ message: 'test data' });
    assert.ok(testResult instanceof TemplateResult);
    
    const userFactory = (instance.templateFactories as any).UserTemplate;
    const userResult = userFactory({ name: 'Test', email: 'test@example.com' });
    assert.ok(userResult instanceof TemplateResult);
    
    // Should log info about template building
    const logger = instance.testLogger;
    assert.ok((logger.info as any).mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes('Building template component factories')
    ));
    assert.ok((logger.info as any).mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes('Successfully built 2 template factories')
    ));
  });

  t.test('should handle empty registries gracefully', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    // Don't register anything - test empty registries
    
    await instance.setup();
    
    // Should have empty factories objects
    assert.deepStrictEqual(Object.keys(instance.tagFactories), []);
    assert.deepStrictEqual(Object.keys(instance.templateFactories), []);
    
    // Should still log about building
    const logger = instance.testLogger;
    assert.ok((logger.info as any).mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes('Successfully built 0 tag factories')
    ));
    assert.ok((logger.info as any).mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes('Successfully built 0 template factories')
    ));
  });

  t.test('should log debug messages for each registered tag and template', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    const testTag = new TestTag('test');
    const testTemplate = new TestTemplate({ message: 'test' });
    
    // Register single items
    BaseDi.register(testTag, { key: 'TemplateTag.test', tags: new Set(['Template:Tag']), singleton: false });
    BaseDi.register(testTemplate, { key: 'Template.TestTemplate', tags: new Set(['Template']), singleton: false });
    
    await instance.setup();
    
    const logger = instance.testLogger;
    
    // Should log debug for each registered item
    assert.ok((logger.debug as any).mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes("Registered tag 'test'")
    ));
    assert.ok((logger.debug as any).mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes("Registered template component 'TestTemplate'")
    ));
  });
});
