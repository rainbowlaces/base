import { TemplateValue } from './templateValue';
import { TemplateResult } from './templateResult';
import { isRenderable } from './renderable';

/**
 * The tagged template literal function. It interleaves static strings and dynamic
 * values into a structured array of Renderable objects.
 * Everything is sanitized by default - use unsafe() to bypass.
 */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): TemplateResult {
  const result = [];
  
  // A tagged template has N strings and N-1 values
  for (let i = 0; i < strings.length; i++) {
    result.push(new TemplateValue(strings[i]));
    if (i < values.length) {
      const value = values[i];
      if (isRenderable(value)) {
        result.push(value);
      } else {
        result.push(new TemplateValue(value));
      }
    }
  }

  return new TemplateResult(result);
}
