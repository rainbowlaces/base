import { test } from 'node:test';
import * as assert from 'node:assert';

import { IfTag } from '../../../src/modules/templates/engine/tags/ifTag.js';
import { TemplateValue } from '../../../src/modules/templates/engine/templateValue.js';

test('IfTag conditional rendering', (t) => {

  t.test('should choose then path when condition is true', async () => {
    const thenContent = 'This is true';
    const elseContent = 'This is false';
    
    const ifTag = new IfTag(true, {
      then: thenContent,
      else: elseContent
    });
    
    const result = await ifTag.render();
    
    assert.strictEqual(result, thenContent);
  });

  t.test('should choose else path when condition is false', async () => {
    const thenContent = 'This is true';
    const elseContent = 'This is false';
    
    const ifTag = new IfTag(false, {
      then: thenContent,
      else: elseContent
    });
    
    const result = await ifTag.render();
    
    assert.strictEqual(result, elseContent);
  });

  t.test('should return empty string when condition is false and no else provided', async () => {
    const thenContent = 'This is true';
    
    const ifTag = new IfTag(false, {
      then: thenContent
    });
    
    const result = await ifTag.render();
    
    assert.strictEqual(result, '');
  });

  t.test('should handle Renderable objects in then/else', async () => {
    const thenRenderable = new TemplateValue('<then>content</then>');
    const elseRenderable = new TemplateValue('<else>content</else>');
    
    const trueTag = new IfTag(true, {
      then: thenRenderable,
      else: elseRenderable
    });
    
    const falseTag = new IfTag(false, {
      then: thenRenderable,
      else: elseRenderable
    });
    
    const trueResult = await trueTag.render();
    const falseResult = await falseTag.render();
    
    // Content should be sanitized by TemplateValue (HTML tags stripped)
    assert.strictEqual(trueResult, 'content');
    assert.strictEqual(falseResult, 'content');
  });

  t.test('should have correct name property', () => {
    const ifTag = new IfTag(true, { then: 'test' });
    
    assert.strictEqual(ifTag.name, 'if');
  });

  t.test('should handle string templates with special characters', async () => {
    const thenContent = 'Success - <value>';
    const elseContent = 'Error - &amp; failed';
    
    const ifTag = new IfTag(true, {
      then: thenContent,
      else: elseContent
    });
    
    const result = await ifTag.render();
    
    // Should sanitize the content (HTML tags stripped)
    assert.strictEqual(result, 'Success - ');
  });
});
