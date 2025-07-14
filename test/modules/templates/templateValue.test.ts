import { test } from 'node:test';
import * as assert from 'node:assert';

import { TemplateValue } from '../../../src/modules/templates/engine/templateValue.js';

test('TemplateValue handling', (t) => {

  t.test('should return empty string for null', async () => {
    const templateValue = new TemplateValue(null);
    const result = await templateValue.render();
    
    assert.strictEqual(result, '');
  });

  t.test('should return empty string for undefined', async () => {
    const templateValue = new TemplateValue(undefined);
    const result = await templateValue.render();
    
    assert.strictEqual(result, '');
  });

  t.test('should stringify objects', async () => {
    const obj = { name: 'test', value: 42 };
    const templateValue = new TemplateValue(obj);
    const result = await templateValue.render();
    
    // Should stringify the object and escape dangerous characters
    assert.strictEqual(result, '[object Object]');
  });

  t.test('should pass through primitives', async () => {
    const tests = [
      { input: 'hello', expected: 'hello' },
      { input: 42, expected: '42' },
      { input: true, expected: 'true' },
      { input: false, expected: 'false' }
    ];

    for (const { input, expected } of tests) {
      const templateValue = new TemplateValue(input);
      const result = await templateValue.render();
      assert.strictEqual(result, expected);
    }
  });

  t.test('should sanitize dangerous content in primitives', async () => {
    const dangerous = '<script>alert("xss")</script>';
    const templateValue = new TemplateValue(dangerous);
    const result = await templateValue.render();
    
    // Should strip HTML tags completely, leaving empty string
    assert.strictEqual(result, '');
  });

  t.test('should handle promised values', async () => {
    const promisedValue = Promise.resolve('async value');
    const templateValue = new TemplateValue(promisedValue);
    const result = await templateValue.render();
    
    assert.strictEqual(result, 'async value');
  });

  t.test('should handle promised null/undefined', async () => {
    const promisedNull = Promise.resolve(null);
    const templateValue = new TemplateValue(promisedNull);
    const result = await templateValue.render();
    
    assert.strictEqual(result, '');
  });
});
