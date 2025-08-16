import { test } from 'node:test';
import * as assert from 'node:assert';

import { UnsafeTag } from '../../../src/modules/templates/engine/tags/unsafeTag.js';

test('UnsafeTag bypasses sanitization', (t) => {

  t.test('should render raw HTML without sanitization', async () => {
    const rawHtml = '<div class="test">Raw HTML content</div>';
    const unsafeTag = new UnsafeTag(rawHtml);
    
    const result = await unsafeTag.render();
    
    // Should NOT be sanitized
    assert.strictEqual(result, rawHtml);
  });

  t.test('should bypass sanitization for dangerous content', async () => {
    const dangerous = '<script>alert("xss")</script>';
    const unsafeTag = new UnsafeTag(dangerous);
    
    const result = await unsafeTag.render();
    
    // Should NOT sanitize the dangerous content
    assert.strictEqual(result, dangerous);
  });

  t.test('should handle various HTML entities without escaping', async () => {
    const htmlWithEntities = '&lt;div&gt;Pre-escaped &amp; entities&lt;/div&gt;';
    const unsafeTag = new UnsafeTag(htmlWithEntities);
    
    const result = await unsafeTag.render();
    
    assert.strictEqual(result, htmlWithEntities);
  });

  t.test('should convert non-string values to strings', async () => {
    const numberValue = 12345;
    const unsafeTag = new UnsafeTag(numberValue);
    
    const result = await unsafeTag.render();
    
    assert.strictEqual(result, '12345');
  });

  t.test('should handle objects by converting to string', async () => {
    const objValue = { toString: () => '<custom>object</custom>' };
    const unsafeTag = new UnsafeTag(objValue);
    
    const result = await unsafeTag.render();
    
    assert.strictEqual(result, '<custom>object</custom>');
  });

  t.test('should have correct name property', () => {
    const unsafeTag = new UnsafeTag('test');
    
    assert.strictEqual(unsafeTag.name, 'unsafe');
  });
});
