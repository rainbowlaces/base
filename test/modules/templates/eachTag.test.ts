import { test } from 'node:test';
import * as assert from 'node:assert';
import { mock } from 'node:test';

import { EachTag } from '../../../src/modules/templates/engine/tags/eachTag.js';
import { TemplateValue } from '../../../src/modules/templates/engine/templateValue.js';

test('EachTag iterates and renders', (t) => {

  t.test('should iterate iterable and call do function', async () => {
    const items = ['apple', 'banana', 'cherry'];
    const doFn = mock.fn((item: string) => new TemplateValue(`Item - ${item}`));
    
    const eachTag = new EachTag(items, { do: doFn });
    const result = await eachTag.render();
    
    // Should call do function for each item
    assert.strictEqual(doFn.mock.callCount(), 3);
    assert.deepStrictEqual(doFn.mock.calls[0].arguments, ['apple']);
    assert.deepStrictEqual(doFn.mock.calls[1].arguments, ['banana']);
    assert.deepStrictEqual(doFn.mock.calls[2].arguments, ['cherry']);
    
    // Should render all items (avoiding colon which gets escaped)
    assert.strictEqual(result, 'Item - appleItem - bananaItem - cherry');
  });

  t.test('should return else content when iterable is empty', async () => {
    const emptyArray: string[] = [];
    const elseContent = 'No items found';
    const doFn = mock.fn(() => new TemplateValue(''));
    
    const eachTag = new EachTag(emptyArray, { 
      do: doFn,
      else: elseContent 
    });
    
    const result = await eachTag.render();
    
    // Should not call do function
    assert.strictEqual(doFn.mock.callCount(), 0);
    // Should return else content
    assert.strictEqual(result, elseContent);
  });

  t.test('should return empty string when iterable is empty and no else provided', async () => {
    const emptyArray: string[] = [];
    const doFn = mock.fn(() => new TemplateValue(''));
    
    const eachTag = new EachTag(emptyArray, { do: doFn });
    const result = await eachTag.render();
    
    assert.strictEqual(doFn.mock.callCount(), 0);
    assert.strictEqual(result, '');
  });

  t.test('should handle null/undefined iterables', async () => {
    const elseContent = 'Nothing to show';
    const doFn = mock.fn(() => new TemplateValue(''));
    
    const nullTag = new EachTag(null, { 
      do: doFn,
      else: elseContent 
    });
    
    const undefinedTag = new EachTag(undefined, { 
      do: doFn,
      else: elseContent 
    });
    
    const nullResult = await nullTag.render();
    const undefinedResult = await undefinedTag.render();
    
    assert.strictEqual(nullResult, elseContent);
    assert.strictEqual(undefinedResult, elseContent);
    assert.strictEqual(doFn.mock.callCount(), 0);
  });

  t.test('should handle async do functions', async () => {
    const items = ['one', 'two'];
    const asyncDoFn = mock.fn(async (item: string) => {
      return new TemplateValue(`Async - ${item}`);
    });
    
    const eachTag = new EachTag(items, { do: asyncDoFn });
    const result = await eachTag.render();
    
    assert.strictEqual(asyncDoFn.mock.callCount(), 2);
    assert.strictEqual(result, 'Async - oneAsync - two');
  });

  t.test('should handle Set and other iterables', async () => {
    const itemSet = new Set(['unique1', 'unique2']);
    const doFn = mock.fn((item: string) => new TemplateValue(`Set - ${item}`));
    
    const eachTag = new EachTag(itemSet, { do: doFn });
    const result = await eachTag.render();
    
    assert.strictEqual(doFn.mock.callCount(), 2);
    assert.ok(result.includes('Set - unique1'));
    assert.ok(result.includes('Set - unique2'));
  });

  t.test('should have correct name property', () => {
    const eachTag = new EachTag([], {});
    
    assert.strictEqual(eachTag.name, 'each');
  });
});
