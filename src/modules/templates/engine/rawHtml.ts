import { Renderable } from './renderable.js';

/**
 * A special Renderable for raw HTML content that should not be sanitized.
 * This is used for string literals in templates that contain HTML markup.
 */
export class RawHtml extends Renderable {
  
  async render(): Promise<string> {
    const resolved = await this.value;
    return String(resolved);
  }
}
