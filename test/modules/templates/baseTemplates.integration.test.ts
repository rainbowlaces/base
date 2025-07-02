import { test } from 'node:test';
import * as assert from 'node:assert';

// Core DI system
import { BaseDi } from '../../../src/core/di/baseDi';

// Template engine imports
import { BaseTemplate } from '../../../src/modules/templates/baseTemplate';
import type { TemplateResult } from '../../../src/modules/templates/engine/templateResult';
import { html } from '../../../src/modules/templates/engine/html';
import { IfTag } from '../../../src/modules/templates/engine/tags/ifTag';
import { EachTag } from '../../../src/modules/templates/engine/tags/eachTag';

// Decorators for test classes
import { template } from '../../../src/modules/templates/decorators/template';

// Import the test helpers from core test file
import { 
  RESET_TEST_ENVIRONMENT,
  CREATE_TEST_INSTANCE
} from './baseTemplates.core.test';

// Create test classes for integration testing
@template()
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
  t.test('master template should correctly render nested templates and tags', async () => {
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
