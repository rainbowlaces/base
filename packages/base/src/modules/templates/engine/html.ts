import { TemplateValue } from './templateValue.js';
import { TemplateResult } from './templateResult.js';
import { RawHtml } from './rawHtml.js';
import { isRenderable } from './renderable.js';

/**
 * The tagged template literal function. It interleaves static strings and dynamic
 * values into a structured array of Renderable objects.
 * Static strings are treated as raw HTML, interpolated values are sanitized.
 */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): TemplateResult {
  const result = [];
  
  // A tagged template has N strings and N-1 values
  for (let i = 0; i < strings.length; i++) {
    // String literals are raw HTML and should not be escaped
    result.push(new RawHtml(strings[i]));
    if (i < values.length) {
      const value = values[i];
      if (isRenderable(value)) {
        result.push(value);
      } else {
        // Interpolated values should be sanitized
        result.push(new TemplateValue(value));
      }
    }
  }

  return new TemplateResult(result);
}
