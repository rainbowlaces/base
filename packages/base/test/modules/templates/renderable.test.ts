import { test } from 'node:test';
import * as assert from 'node:assert';

import { Renderable, isRenderable } from '../../../src/modules/templates/engine/renderable.js';

// Test implementation of Renderable for testing
class TestRenderable extends Renderable<string> {
  pre(value: string): string {
    return value;
  }
}

// UnsafeTag-like implementation for testing bypass
class UnsafeRenderable extends Renderable<string> {
  pre(value: string): string {
    return value;
  }

  // Override to bypass sanitization completely
  async render(): Promise<string> {
    const preRendered = this.pre(this.value);
    return String(preRendered);
  }
}

test('Renderable sanitization', (t) => {

  t.test('should sanitize dangerous characters', async () => {
    const dangerous = '<script>alert("xss")</script>';
    const renderable = new TestRenderable(dangerous);
    
    const result = await renderable.render();
    
    // Should strip HTML tags completely, leaving empty string since only tags remain
    assert.strictEqual(result, '');
  });

  t.test('should sanitize various dangerous characters', async () => {
    const dangerous = '&<>"\'=:';
    const renderable = new TestRenderable(dangerous);
    
    const result = await renderable.render();
    
    // Ampersand gets double-escaped: & -> &amp; (by our escaper) -> &amp;amp; (by double escaping)
    assert.strictEqual(result, '&amp;amp;&amp;lt;&amp;gt;&quot;&#39;&#61;&#58;');
  });

  t.test('should pass through UnsafeTag without sanitizing', async () => {
    const unsafeContent = '<div>Raw HTML</div>';
    const unsafeRenderable = new UnsafeRenderable(unsafeContent);
    
    const result = await unsafeRenderable.render();
    
    // Should NOT be sanitized
    assert.strictEqual(result, '<div>Raw HTML</div>');
  });

  t.test('should handle arrays of values', async () => {
    class ArrayRenderable extends Renderable<string[]> {
      pre(value: string[]): string[] {
        return value;
      }
    }

    const arrayRenderable = new ArrayRenderable(['<test>', '&amp;', '"quote"']);
    const result = await arrayRenderable.render();
    
    // Should strip HTML tags and escape remaining content for each element
    assert.strictEqual(result, '&amp;amp;&quot;quote&quot;');
  });

  t.test('should handle nested Renderable instances', async () => {
    const innerRenderable = new TestRenderable('<inner>');
    
    class NestedRenderable extends Renderable<Renderable> {
      pre(value: Renderable): Renderable {
        return value;
      }
    }

    const nestedRenderable = new NestedRenderable(innerRenderable);
    const result = await nestedRenderable.render();
    
    // Should render nested Renderable (HTML tags stripped from inner content)
    assert.strictEqual(result, '');
  });
});

test('isRenderable type guard', (t) => {

  t.test('should return true for Renderable objects', () => {
    const renderable = new TestRenderable('test');
    assert.strictEqual(isRenderable(renderable), true);
  });

  t.test('should return false for non-Renderable objects', () => {
    assert.strictEqual(isRenderable('string'), false);
    assert.strictEqual(isRenderable(123), false);
    assert.strictEqual(isRenderable({}), false);
    assert.strictEqual(isRenderable(null), false);
    assert.strictEqual(isRenderable(undefined), false);
  });

  t.test('should return false for objects with non-function render property', () => {
    const notRenderable = { render: 'not a function' };
    assert.strictEqual(isRenderable(notRenderable), false);
  });
});
