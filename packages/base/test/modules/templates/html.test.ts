import { test } from 'node:test';
import * as assert from 'node:assert';

import { html } from '../../../src/modules/templates/engine/html.js';
import { TemplateResult } from '../../../src/modules/templates/engine/templateResult.js';
import { Renderable } from '../../../src/modules/templates/engine/renderable.js';

// Simple test renderable
class TestRenderable extends Renderable<string> {
  pre(value: string): string {
    return value;
  }
}

test('html() tagged template function', (t) => {

  t.test('should build TemplateResult with correct interleaving', async () => {
    const name = 'World';
    const result = html`Hello ${name}!`;
    
    assert.ok(result instanceof TemplateResult);
    
    const rendered = await result.render();
    assert.strictEqual(rendered, 'Hello World!');
  });

  t.test('should handle multiple values', async () => {
    const greeting = 'Hello';
    const name = 'World';
    const punctuation = '!';
    
    const result = html`${greeting} ${name}${punctuation}`;
    const rendered = await result.render();
    
    assert.strictEqual(rendered, 'Hello World!');
  });

  t.test('should sanitize values by default', async () => {
    const dangerous = '<script>alert("xss")</script>';
    const result = html`Content: ${dangerous}`;
    const rendered = await result.render();
    
    // Should strip HTML tags completely
    assert.strictEqual(rendered, 'Content: ');
  });

  t.test('should not wrap values that are already Renderable', async () => {
    const existingRenderable = new TestRenderable('hello <p>hello</p> hello');
    const result = html`Value: ${existingRenderable}`;
    const rendered = await result.render();
    
    // The existing renderable should be used as-is (HTML tags stripped)
    assert.strictEqual(rendered, 'Value: hello hello hello');
  });

  t.test('should return TemplateResult instance', () => {
    const result = html`Simple template`;
    
    assert.ok(result instanceof TemplateResult);
  });

  t.test('should handle no interpolated values', async () => {
    const result = html`Just static text`;
    const rendered = await result.render();
    
    assert.strictEqual(rendered, 'Just static text');
  });

  t.test('should handle empty template', async () => {
    const result = html``;
    const rendered = await result.render();
    
    assert.strictEqual(rendered, '');
  });

  t.test('should handle complex nesting', async () => {
    const user = { name: 'John', age: 30 };
    const isAdmin = true;
    
    const result = html`
      <div>
        Name: ${user.name}
        Age: ${user.age}
        Admin: ${isAdmin}
      </div>
    `;
    
    const rendered = await result.render();
    
    // Should contain the interpolated values
    assert.ok(rendered.includes('John'));
    assert.ok(rendered.includes('30'));
    assert.ok(rendered.includes('true'));
  });
});
