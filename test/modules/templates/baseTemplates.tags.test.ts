import { test } from 'node:test';
import * as assert from 'node:assert';

// Template engine imports
import { IfTag } from '../../../src/modules/templates/engine/tags/ifTag';
import { EachTag } from '../../../src/modules/templates/engine/tags/eachTag';
import { UnsafeTag } from '../../../src/modules/templates/engine/tags/unsafeTag';
import { html } from '../../../src/modules/templates/engine/html';

// Import the test helpers from core test file
import { 
  RESET_TEST_ENVIRONMENT 
} from './baseTemplates.core.test';

// UT-TAG tests for standard tags
test.skip('Standard Tags Functionality', (t) => {
  t.beforeEach(() => {
    RESET_TEST_ENVIRONMENT();
  });

  t.afterEach(() => {
    RESET_TEST_ENVIRONMENT();
  });

  // UT-TAG-01: Test IfTag basic functionality
  t.test('IfTag should conditionally render based on condition', async () => {
    const trueIf = new IfTag(true, {
      then: 'Then branch',
      else: 'Else branch'
    });
    
    const falseIf = new IfTag(false, {
      then: 'Then branch',
      else: 'Else branch'
    });
    
    assert.strictEqual(await trueIf.render(), 'Then branch');
    assert.strictEqual(await falseIf.render(), 'Else branch');
  });
  
  // UT-TAG-02: Test IfTag with nested templates
  t.test('IfTag should work with nested template results', async () => {
    const trueIf = new IfTag(true, {
      then: html`<div>Success</div>`,
      else: html`<div>Failure</div>`
    });
    
    const rendered = await trueIf.render();
    assert.strictEqual(rendered, '<div>Success</div>');
  });
  
  // UT-TAG-03: Test IfTag without else branch
  t.test('IfTag should return empty string when condition is false and no else branch', async () => {
    const ifTag = new IfTag(false, {
      then: 'Then branch'
    });
    
    assert.strictEqual(await ifTag.render(), '');
  });

  // UT-TAG-04: Test EachTag basic functionality
  t.test('EachTag should iterate over arrays and apply transformation', async () => {
    const items = ['one', 'two', 'three'];
    const eachTag = new EachTag(items, {
      do: (item) => html`<li>${item}</li>`
    });
    
    const rendered = await eachTag.render();
    assert.strictEqual(rendered, '<li>one</li><li>two</li><li>three</li>');
  });
  
  // UT-TAG-05: Test EachTag with empty array
  t.test('EachTag should return empty string for empty array', async () => {
    const emptyItems: string[] = [];
    const eachTag = new EachTag(emptyItems, {
      do: (item) => html`<li>${item}</li>`
    });
    
    assert.strictEqual(await eachTag.render(), '');
  });
  
  // UT-TAG-06: Test EachTag with complex transformation
  t.test('EachTag should support complex transformations', async () => {
    const users = [
      { name: 'Alice', role: 'admin' },
      { name: 'Bob', role: 'user' }
    ];
    
    const eachTag = new EachTag(users, {
      do: (user) => html`<div class="user ${user.role}">${user.name}</div>`
    });
    
    const rendered = await eachTag.render();
    assert.ok(rendered.includes('<div class="user admin">Alice</div>'));
    assert.ok(rendered.includes('<div class="user user">Bob</div>'));
  });

  // UT-TAG-07: Test UnsafeTag basic functionality
  t.test('UnsafeTag should not escape HTML content', async () => {
    const unsafeTag = new UnsafeTag('<b>Bold text</b> and <i>italic text</i>');
    const rendered = await unsafeTag.render();
    
    assert.strictEqual(rendered, '<b>Bold text</b> and <i>italic text</i>');
  });
  
  // UT-TAG-08: Test UnsafeTag with potentially malicious content
  t.test('UnsafeTag should allow script tags (though this is potentially dangerous)', async () => {
    const unsafeTag = new UnsafeTag('<script>alert("XSS")</script>');
    const rendered = await unsafeTag.render();
    
    assert.strictEqual(rendered, '<script>alert("XSS")</script>');
  });
});
