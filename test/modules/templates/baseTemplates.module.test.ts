import { test } from 'node:test';
import * as assert from 'node:assert';

// Import the test helpers from core test file
import { 
  RESET_TEST_ENVIRONMENT,
  CREATE_TEST_INSTANCE,
  TestTag,
  UppercaseTag,
  MOCK_LOGGER
} from './baseTemplates.core.test.js';

// Access the actual mock functions from the core test file
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCK_DEBUG = (MOCK_LOGGER as any).debug;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCK_INFO = (MOCK_LOGGER as any).info;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCK_WARN = (MOCK_LOGGER as any).warn;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCK_ERROR = (MOCK_LOGGER as any).error;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCK_TRACE = (MOCK_LOGGER as any).trace;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCK_FATAL = (MOCK_LOGGER as any).fatal;

test('BaseTemplates setup() method', (t) => {
  t.beforeEach(async () => {
    await RESET_TEST_ENVIRONMENT();
    
    // Reset all mock calls for each test
    MOCK_DEBUG.mock.resetCalls();
    MOCK_INFO.mock.resetCalls();
    MOCK_WARN.mock.resetCalls();
    MOCK_ERROR.mock.resetCalls();
    MOCK_TRACE.mock.resetCalls();
    MOCK_FATAL.mock.resetCalls();
  });

  t.afterEach(async () => {
    await RESET_TEST_ENVIRONMENT();
  });

  t.test('should correctly create tag factories from registered tags', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    await instance.setup();
    
    // Check that tag factories were created
    assert.ok('test' in instance.tagFactories);
    assert.ok('uppercase' in instance.tagFactories);
    
    // Verify factories are functions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.strictEqual(typeof (instance.tagFactories as any).test, 'function');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.strictEqual(typeof (instance.tagFactories as any).uppercase, 'function');
    
    // Test that factories work correctly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const testTag = (instance.tagFactories as any).test('hello world');
    assert.ok(testTag instanceof TestTag);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uppercaseTag = (instance.tagFactories as any).uppercase('hello world');
    assert.ok(uppercaseTag instanceof UppercaseTag);
    
    // Check logging
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.ok(MOCK_INFO.mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes('Building template tag factories')
    ));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.ok(MOCK_INFO.mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes('Successfully built') && 
      (call.arguments[0] as string).includes('tag factories')
    ));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.ok(MOCK_DEBUG.mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes("Registered tag 'test'")
    ));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.ok(MOCK_DEBUG.mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes("Registered tag 'uppercase'")
    ));
  });

  t.test('should correctly create template factories from registered templates', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    await instance.setup();
    
    // Check that template factories were created
    assert.ok('TestUserCard' in instance.templateFactories);
    assert.ok('TestUserList' in instance.templateFactories);
    
    // Verify factories are functions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.strictEqual(typeof (instance.templateFactories as any).TestUserCard, 'function');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.strictEqual(typeof (instance.templateFactories as any).TestUserList, 'function');
    
    // Test that factories work correctly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userCardResult = (instance.templateFactories as any).TestUserCard({ name: 'John', isAdmin: true });
    
    assert.strictEqual(userCardResult.constructor.name, 'TemplateResult');
    
    // Logging assertions moved to use MOCK_INFO and MOCK_DEBUG functions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.ok(MOCK_INFO.mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes('Building template component factories')
    ));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.ok(MOCK_INFO.mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes('Successfully built') && 
      (call.arguments[0] as string).includes('template factories')
    ));
  });

  t.test('should handle cases where no tags or templates are registered', async () => {
    // Clear the DI container completely and don't register any test classes
    const { BaseDi } = await import('../../../src/core/di/baseDi');
    await BaseDi.teardown();
    
    // Make sure we register the BaseLogger dependency
    BaseDi.register(MOCK_LOGGER, { key: "BaseLogger" });
    
    const instance = CREATE_TEST_INSTANCE();
    
    await instance.setup();
    
    // Should have empty factories
    assert.deepStrictEqual(Object.keys(instance.tagFactories), []);
    assert.deepStrictEqual(Object.keys(instance.templateFactories), []);
    
    // Check logging shows zero factories
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.ok(MOCK_INFO.mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes('Successfully built 0 tag factories')
    ));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.ok(MOCK_INFO.mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes('Successfully built 0 template factories')
    ));
  });

  t.test('should log debug messages during setup process', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    await instance.setup();
    
    // Verify all expected debug and info messages were logged
    assert.ok(MOCK_DEBUG.mock.callCount() >= 4); // At least 4 debug calls (2 per registered item)
    assert.ok(MOCK_INFO.mock.callCount() >= 4);  // At least 4 info calls (start/end for tags and templates)
  });
});

test('BaseTemplates teardown() method', (t) => {
  t.beforeEach(async () => {
    await RESET_TEST_ENVIRONMENT();
    
    // Reset all mock calls for each test
    MOCK_DEBUG.mock.resetCalls();
    MOCK_INFO.mock.resetCalls();
    MOCK_WARN.mock.resetCalls();
    MOCK_ERROR.mock.resetCalls();
    MOCK_TRACE.mock.resetCalls();
    MOCK_FATAL.mock.resetCalls();
  });

  t.afterEach(async () => {
    await RESET_TEST_ENVIRONMENT();
  });

  t.test('should log shutdown message', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    await instance.teardown();
    
    // Verify shutdown message was logged
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.ok(MOCK_INFO.mock.calls.some((call: any) => 
      (call.arguments[0] as string).includes('BaseTemplates module shutdown')
    ));
  });
});

test('BaseTemplates factory functionality', (t) => {
  t.beforeEach(async () => {
    await RESET_TEST_ENVIRONMENT();
  });

  t.afterEach(async () => {
    await RESET_TEST_ENVIRONMENT();
  });

  t.test('tag factories should resolve from DI and work correctly', async () => {
    const instance = CREATE_TEST_INSTANCE();
    await instance.setup();
    
    // Create tags using factories
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const testTag = (instance.tagFactories as any).test('hello');
    const renderedTest = await testTag.render();
    assert.strictEqual(renderedTest, '[TEST: hello]');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uppercaseTag = (instance.tagFactories as any).uppercase('world');
    const renderedUppercase = await uppercaseTag.render();
    assert.strictEqual(renderedUppercase, 'WORLD');
  });

  t.test('template factories should resolve from DI and render correctly', async () => {
    const instance = CREATE_TEST_INSTANCE();
    await instance.setup();
    
    // Create template using factory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userCardResult = (instance.templateFactories as any).TestUserCard({ 
      name: 'Alice', 
      isAdmin: false 
    });
    
    const rendered = await userCardResult.render();
    
    // Should contain the user name and not contain admin badge
    assert.ok(rendered.includes('Alice'));
    assert.ok(!rendered.includes('Admin'));
    assert.ok(rendered.includes('user-card'));
  });

  t.test('template factories should handle parameters correctly', async () => {
    const instance = CREATE_TEST_INSTANCE();
    await instance.setup();
    
    // Test with admin user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminResult = (instance.templateFactories as any).TestUserCard({ 
      name: 'Bob', 
      isAdmin: true 
    });
    
    const adminRendered = await adminResult.render();
    assert.ok(adminRendered.includes('Bob'));
    assert.ok(adminRendered.includes('Admin'));
    
    // Test with regular user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userResult = (instance.templateFactories as any).TestUserCard({ 
      name: 'Charlie', 
      isAdmin: false 
    });
    
    const userRendered = await userResult.render();
    assert.ok(userRendered.includes('Charlie'));
    assert.ok(!userRendered.includes('Admin'));
  });
});
