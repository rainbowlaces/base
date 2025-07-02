import { test } from 'node:test';
import * as assert from 'node:assert';
import { mock } from 'node:test';

// Import the test helpers from core test file
import { 
  RESET_TEST_ENVIRONMENT,
  CREATE_TEST_INSTANCE,
  TestTag,
  UppercaseTag,
  TestUserCard
} from './baseTemplates.core.test';

// Mock logger functions for testing
const MOCK_DEBUG = mock.fn();
const MOCK_INFO = mock.fn();
const MOCK_WARN = mock.fn();
const MOCK_ERROR = mock.fn();
const MOCK_TRACE = mock.fn();
const MOCK_FATAL = mock.fn();

test.skip('BaseTemplates setup() method', (t) => {
  t.beforeEach(() => {
    RESET_TEST_ENVIRONMENT();
    
    // Reset all mock calls for each test
    MOCK_DEBUG.mock.resetCalls();
    MOCK_INFO.mock.resetCalls();
    MOCK_WARN.mock.resetCalls();
    MOCK_ERROR.mock.resetCalls();
    MOCK_TRACE.mock.resetCalls();
    MOCK_FATAL.mock.resetCalls();
  });

  t.afterEach(() => {
    RESET_TEST_ENVIRONMENT();
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
    assert.ok(MOCK_INFO.mock.calls.some((call) => 
      (call.arguments[0] as string).includes('Building template tag factories')
    ));
    assert.ok(MOCK_INFO.mock.calls.some((call) => 
      (call.arguments[0] as string).includes('Successfully built 2 tag factories')
    ));
    assert.ok(MOCK_DEBUG.mock.calls.some((call) => 
      (call.arguments[0] as string).includes("Registered tag 'test'")
    ));
    assert.ok(MOCK_DEBUG.mock.calls.some((call) => 
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
    assert.ok(userCardResult instanceof TestUserCard);
    
    // Logging assertions moved to use MOCK_INFO and MOCK_DEBUG functions
    assert.ok(MOCK_INFO.mock.calls.some((call) => 
      (call.arguments[0] as string).includes('Building template factories')
    ));
    assert.ok(MOCK_INFO.mock.calls.some((call) => 
      (call.arguments[0] as string).includes('Successfully built 2 template factories')
    ));
  });

  t.test('should handle cases where no tags or templates are registered', async () => {
    // First reset the DI container
    RESET_TEST_ENVIRONMENT();
    
    // Now don't register any test classes
    const instance = CREATE_TEST_INSTANCE();
    
    await instance.setup();
    
    // Should have empty factories
    assert.deepStrictEqual(Object.keys(instance.tagFactories), []);
    assert.deepStrictEqual(Object.keys(instance.templateFactories), []);
    
    // Check logging shows zero factories
    assert.ok(MOCK_INFO.mock.calls.some((call) => 
      (call.arguments[0] as string).includes('Successfully built 0 tag factories')
    ));
    assert.ok(MOCK_INFO.mock.calls.some((call) => 
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

test.skip('BaseTemplates teardown() method', (t) => {
  t.beforeEach(() => {
    RESET_TEST_ENVIRONMENT();
    
    // Reset all mock calls for each test
    MOCK_DEBUG.mock.resetCalls();
    MOCK_INFO.mock.resetCalls();
    MOCK_WARN.mock.resetCalls();
    MOCK_ERROR.mock.resetCalls();
    MOCK_TRACE.mock.resetCalls();
    MOCK_FATAL.mock.resetCalls();
  });

  t.afterEach(() => {
    RESET_TEST_ENVIRONMENT();
  });

  t.test('should log shutdown message', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    await instance.teardown();
    
    // Verify shutdown message was logged
    assert.ok(MOCK_INFO.mock.calls.some((call) => 
      (call.arguments[0] as string).includes('BaseTemplates module shutdown')
    ));
  });
});

test.skip('BaseTemplates factory functionality', (t) => {
  t.beforeEach(() => {
    RESET_TEST_ENVIRONMENT();
  });

  t.afterEach(() => {
    RESET_TEST_ENVIRONMENT();
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
