import { Renderable } from './renderable';

/**
 * A specific Renderable for wrapping primitive or promised values from templates.
 * Simplified version that sanitizes everything by default.
 */
export class TemplateValue extends Renderable {
  
  async pre(value: unknown): Promise<unknown> {
    const resolvedValue = await value;
    
    if (resolvedValue === null || resolvedValue === undefined) {
      return "";
    }

    if (typeof resolvedValue === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return String(resolvedValue);
    }
    
    return resolvedValue;
  }
}
