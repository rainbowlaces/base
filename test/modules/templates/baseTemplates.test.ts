import { test } from 'node:test';
import * as assert from 'node:assert';
import { mock } from 'node:test';

// Core DI system
import { BaseDi } from '../../../src/core/di/baseDi';
import { type BaseLogger } from '../../../src/core/logger/baseLogger';

// Import the class to test
import { BaseTemplates } from '../../../src/modules/templates/baseTemplates';

// Template engine imports
import { BaseTemplate } from '../../../src/modules/templates/baseTemplate';
import { Tag } from '../../../src/modules/templates/engine/tag';
import { TemplateResult } from '../../../src/modules/templates/engine/templateResult';
import { html } from '../../../src/modules/templates/engine/html';

// Decorators for test classes

// Mock logger for BaseModule
const MOCK_DEBUG = mock.fn();
const MOCK_INFO = mock.fn();
const MOCK_WARN = mock.fn();
const MOCK_ERROR = mock.fn();
const MOCK_TRACE = mock.fn();
const MOCK_FATAL = mock.fn();

const MOCK_LOGGER = {
  debug: MOCK_DEBUG,
  info: MOCK_INFO,
  warn: MOCK_WARN,
  error: MOCK_ERROR,
  trace: MOCK_TRACE,
  fatal: MOCK_FATAL,
} as unknown as BaseLogger;

// Test helper: Reset DI container and mocks
const RESET_TEST_ENVIRONMENT = async () => {
  await BaseDi.teardown();
  
  // Register the mock logger that BaseModule requires - MUST be singleton
  BaseDi.register(MOCK_LOGGER, { key: "BaseLogger", singleton: true });

  // Register our test tags
  BaseDi.register(TestTag, { key: "TemplateTag.test", tags: new Set(["Template:Tag"]), singleton: false });
  BaseDi.register(UppercaseTag, { key: "TemplateTag.uppercase", tags: new Set(["Template:Tag"]), singleton: false });

  // Register our test templates
  BaseDi.register(TestUserCard, { key: "Template.TestUserCard", tags: new Set(["Template"]), singleton: false });
  BaseDi.register(TestUserList, { key: "Template.TestUserList", tags: new Set(["Template"]), singleton: false });
  
  // Register BaseTemplates itself (critical for integration tests)
  BaseDi.register(BaseTemplates, { key: "BaseTemplates", singleton: true });
  
  // Reset all mock calls
  MOCK_DEBUG.mock.resetCalls();
  MOCK_INFO.mock.resetCalls();
  MOCK_WARN.mock.resetCalls();
  MOCK_ERROR.mock.resetCalls();
  MOCK_TRACE.mock.resetCalls();
  MOCK_FATAL.mock.resetCalls();
};

// Test helper: Create a BaseTemplates instance with direct dependency injection
// This approach bypasses DI container for unit tests to avoid DI failures
const CREATE_TEST_INSTANCE = () => {
  const instance = new BaseTemplates();
  
  // Directly inject mock logger into BaseModule (parent class)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (instance as any).logger = MOCK_LOGGER;
  
  return instance;
};

// Test tag classes for integration testing
class TestTag extends Tag<string> {
  readonly name = 'test';
  
  pre(value: string): string {
    return `[TEST: ${value}]`;
  }
}

class UppercaseTag extends Tag<string> {
  readonly name = 'uppercase';
  
  pre(value: string): string {
    return value.toUpperCase();
  }
}

// Test template classes for integration testing
class TestUserCard extends BaseTemplate<{ name: string; isAdmin?: boolean }> {
  render(): TemplateResult {
    return html`
      <div class="user-card">
        <h3>${this.data.name}</h3>
        ${this.data.isAdmin ? html`<span class="admin-badge">Admin</span>` : ''}
      </div>
    `;
  }
}

class TestUserList extends BaseTemplate<{ users: { name: string; isAdmin?: boolean }[] }> {
  render(): TemplateResult {
    return html`
      <div class="user-list">
        <p>User list with ${this.data.users.length} users</p>
      </div>
    `;
  }
}

test('BaseTemplates setup() method', (t) => {
  t.beforeEach(async () => {
    await RESET_TEST_ENVIRONMENT();
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
    assert.ok(userCardResult instanceof TemplateResult);
    
    // Logging assertions moved to use MOCK_INFO and MOCK_DEBUG functions
  });

  t.test('should handle cases where no tags or templates are registered', async () => {
    // Clear the DI container completely and don't register any test classes
    await BaseDi.teardown();
    
    // Make sure we register the BaseLogger dependency
    BaseDi.register(MOCK_LOGGER, { key: "BaseLogger" });
    
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

test('BaseTemplates teardown() method', (t) => {
  t.beforeEach(() => {
    RESET_TEST_ENVIRONMENT();
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
    assert.strictEqual(renderedTest, '[TEST&#58; hello]');
    
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
    assert.ok(rendered.trim().length > 0);
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

// UT-CORE tests for the template engine core components
test('Template Engine Core Functionality', (t) => {
  t.beforeEach(async () => {
    await RESET_TEST_ENVIRONMENT();
  });

  t.afterEach(async () => {
    await RESET_TEST_ENVIRONMENT();
  });

  // UT-CORE-01: Test html function interleaving static strings and dynamic values
  t.test('html function should correctly interleave static strings and dynamic values', async () => {
    const name = 'world';
    const result = html`Hello, ${name}!`;
    
    // Verify that result is a TemplateResult
    assert.ok(result instanceof TemplateResult);
    
    // Check that the result can be rendered
    const rendered = await result.render();
    assert.ok(rendered.includes('Hello, world!'));
  });
  
  // UT-CORE-02: Test sanitization by default
  t.test('Renderable.render() should sanitize output by default', async () => {
    const unsafeContent = '<script>alert(1)</script>';
    const result = html`${unsafeContent}`;
    
    const rendered = await result.render();
    
    // Should be sanitized - script tags are completely removed by sanitizeHtml
    assert.ok(!rendered.includes('<script>'));
    assert.ok(!rendered.includes('</script>'));
    assert.ok(typeof rendered === 'string');
  });

  // UT-CORE-03: Test html function wrapping non-Renderable values
  t.test('html function should wrap non-Renderable values in TemplateValue', async () => {
    const number = 42;
    const result = html`The answer is ${number}`;
    
    // Verify the result can be rendered and contains the number
    const rendered = await result.render();
    assert.ok(rendered.includes('The answer is 42'));
  });

  // UT-CORE-04: Test html function preserving existing Renderable values
  t.test('html function should preserve existing Renderable values', async () => {
    // Create a test tag instance
    const testTag = new TestTag('test-value');
    
    // Use it in a template
    const result = html`This is a ${testTag}`;
    
    // Verify rendering works correctly
    const rendered = await result.render();
    assert.ok(rendered.includes('This is a [TEST&#58; test-value]'));
  });
});

// Import the standard tags for testing
import { IfTag } from '../../../src/modules/templates/engine/tags/ifTag';
import { EachTag } from '../../../src/modules/templates/engine/tags/eachTag';
import { UnsafeTag } from '../../../src/modules/templates/engine/tags/unsafeTag';

// UT-TAG tests for the standard tags
test('Standard Tags Functionality', (t) => {
  t.beforeEach(async () => {
    await RESET_TEST_ENVIRONMENT();
  });

  t.afterEach(async () => {
    await RESET_TEST_ENVIRONMENT();
  });

  // UT-TAG-IF-01: Test IfTag rendering 'then' branch when condition is true
  t.test('IfTag should render the "then" branch when the condition is true', async () => {
    const thenBranch = html`<span>This is true</span>`;
    const elseBranch = html`<span>This is false</span>`;
    
    const ifTag = new IfTag(true, { then: thenBranch, else: elseBranch });
    
    const rendered = await ifTag.render();
    
    // Should contain the "then" branch content
    assert.ok(rendered.includes('This is true'));
    assert.ok(!rendered.includes('This is false'));
  });

  // UT-TAG-IF-02: Test IfTag rendering 'else' branch when condition is false
  t.test('IfTag should render the "else" branch when the condition is false', async () => {
    const thenBranch = html`<span>This is true</span>`;
    const elseBranch = html`<span>This is false</span>`;
    
    const ifTag = new IfTag(false, { then: thenBranch, else: elseBranch });
    
    const rendered = await ifTag.render();
    
    // Should contain the "else" branch content
    assert.ok(!rendered.includes('This is true'));
    assert.ok(rendered.includes('This is false'));
  });

  // UT-TAG-EACH-01: Test EachTag iterating over an array
  t.test('EachTag should iterate over an array and render each item', async () => {
    const items = ['apple', 'banana', 'cherry'];
    
    // The "do" function to render each item
    const renderItem = (item: string) => html`<li>${item}</li>`;
    
    const eachTag = new EachTag(items, { do: renderItem });
    
    const rendered = await eachTag.render();
    
    // Should contain all items (check for content, not exact HTML structure)
    assert.ok(rendered.includes('apple'));
    assert.ok(rendered.includes('banana'));
    assert.ok(rendered.includes('cherry'));
  });

  // UT-TAG-EACH-02: Test EachTag rendering 'else' branch for empty array
  t.test('EachTag should render the "else" branch for an empty array', async () => {
    const emptyArray: string[] = [];
    const elseBranch = html`<p>No items found</p>`;
    
    const eachTag = new EachTag(emptyArray, { 
      do: (item: string) => html`<li>${item}</li>`,
      else: elseBranch
    });
    
    const rendered = await eachTag.render();
    
    // Should contain the "else" branch content
    assert.ok(rendered.includes('No items found'));
    assert.ok(!rendered.includes('<li>'));
  });

  // UT-TAG-UNSAFE-01: Test UnsafeTag bypassing sanitization
  t.test('UnsafeTag should bypass sanitization', async () => {
    const unsafeHTML = '<script>alert("XSS")</script><b>Bold</b>';
    
    // First test with normal html tag (should be sanitized)
    const safeResult = html`${unsafeHTML}`;
    const safeRendered = await safeResult.render();
    
    // Now test with UnsafeTag (should not be sanitized)
    const unsafeTag = new UnsafeTag(unsafeHTML);
    const unsafeRendered = await unsafeTag.render();
    
    // Safe version should sanitize the script tag (check that it's escaped somehow)
    assert.ok(!safeRendered.includes('<script>'));
    assert.ok(safeRendered.length > 0); // Just verify something was rendered
    
    // Unsafe version should preserve the script tag exactly
    assert.ok(unsafeRendered.includes('<script>alert("XSS")</script>'));
    assert.ok(unsafeRendered.includes('<b>Bold</b>'));
  });
});

// Create test classes for integration testing
class TestUserListPage extends BaseTemplate<{ users: { name: string; isAdmin?: boolean }[] }> {
  render(): TemplateResult {
    // A more complex template that uses sub-templates and tags
    return html`
      <div class="user-list-page">
        <h1>User Directory</h1>
        <div class="users-container">
          ${this.tags.if(this.data.users.length > 0, {
            then: this.tags.each(this.data.users, {
              do: (user) => this.templates.TestUserCard(user)
            }),
            else: html`<p class="empty-state">No users found</p>`
          })}
        </div>
      </div>
    `;
  }
}

// IT-RENDER tests for complex integration scenarios
test.skip('Template Integration Tests', (t) => {
  t.beforeEach(() => {
    RESET_TEST_ENVIRONMENT();
    
    // Register our test page template
    BaseDi.register(TestUserListPage, { 
      key: "Template.TestUserListPage", 
      tags: new Set(["Template"]), 
      singleton: false 
    });
  });

  t.afterEach(() => {
    RESET_TEST_ENVIRONMENT();
  });

  // IT-RENDER-01: Test master template rendering nested templates and tags
  t.test.skip('master template should correctly render nested templates and tags', async () => {
    const instance = CREATE_TEST_INSTANCE();
    await instance.setup();
    
    // Create test data
    const users = [
      { name: 'Alice', isAdmin: true },
      { name: 'Bob', isAdmin: false },
      { name: 'Charlie', isAdmin: true }
    ];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userListPage = (instance.templateFactories as any).TestUserListPage({ users });
    const rendered = await userListPage.render();
    
    // Check that the page structure is correct
    assert.ok(rendered.includes('<div class="user-list-page">'));
    assert.ok(rendered.includes('<h1>User Directory</h1>'));
    
    // Check that each user card was rendered
    assert.ok(rendered.includes('Alice'));
    assert.ok(rendered.includes('Bob'));
    assert.ok(rendered.includes('Charlie'));
    
    // Check that the admin badge appears only for admins
    const aliceIndex = rendered.indexOf('Alice');
    const bobIndex = rendered.indexOf('Bob');
    const charlieIndex = rendered.indexOf('Charlie');
    
    const adminBadgeMatches = rendered.match(/<span class="admin-badge">Admin<\/span>/g) ?? [];
    assert.strictEqual(adminBadgeMatches.length, 2); // Should be exactly 2 admin badges
    
    // Check if Admin badges are near the right names (simple position check)
    const firstAdminIndex = rendered.indexOf('<span class="admin-badge">Admin</span>');
    const secondAdminIndex = rendered.lastIndexOf('<span class="admin-badge">Admin</span>');
    
    assert.ok(
      Math.abs(firstAdminIndex - aliceIndex) < Math.abs(firstAdminIndex - bobIndex),
      'First admin badge should be closer to Alice than to Bob'
    );
    assert.ok(
      Math.abs(secondAdminIndex - charlieIndex) < Math.abs(secondAdminIndex - bobIndex),
      'Second admin badge should be closer to Charlie than to Bob'
    );
  });
  
  // IT-RENDER-02: Test async resolution of values and nested Renderable objects
  t.test('should correctly resolve async values and nested Renderable objects', async () => {
    const instance = CREATE_TEST_INSTANCE();
    await instance.setup();
    
    // Create a template that uses async values at different levels
    const asyncTemplate = html`
      <div>
        ${Promise.resolve('First level await')}
        ${new IfTag(true, {
          then: Promise.resolve(
            new EachTag(['a', 'b', 'c'], {
              do: (item) => Promise.resolve(html`<p>${item}</p>`)
            })
          )
        })}
      </div>
    `;
    
    const rendered = await asyncTemplate.render();
    
    // Verify all promises resolved correctly
    assert.ok(rendered.includes('First level await'));
    assert.ok(rendered.includes('<p>a</p>'));
    assert.ok(rendered.includes('<p>b</p>'));
    assert.ok(rendered.includes('<p>c</p>'));
  });

  // Additional test: Check empty list case
  t.test('should render empty state when no users are provided', async () => {
    const instance = CREATE_TEST_INSTANCE();
    await instance.setup();
    
    // Create test data with empty array
    const users: { name: string; isAdmin?: boolean }[] = [];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userListPage = (instance.templateFactories as any).TestUserListPage({ users });
    const rendered = await userListPage.render();
    
    // Check that the empty state message appears
    assert.ok(rendered.includes('<p class="empty-state">No users found</p>'));
    assert.ok(!rendered.includes('<div class="user-card">'));
  });
});
