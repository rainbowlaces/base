import { Renderable } from './renderable.js';

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
         
        return String(resolvedValue);
    }
    
    return resolvedValue;
  }
}
