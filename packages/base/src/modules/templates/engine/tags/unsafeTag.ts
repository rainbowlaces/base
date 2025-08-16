import { tag } from '../../decorators/tag.js';
import { Tag } from '../tag.js';

/**
 * UnsafeTag bypasses sanitization. Use with extreme caution.
 * This is the ONLY way to output unsanitized content.
 */

@tag()
export class UnsafeTag extends Tag {

  readonly name = 'unsafe';
  
  pre(value: unknown): unknown {
    return value;
  }

  // Override to bypass sanitization completely
  async render(): Promise<string> {
    const preRendered = await this.pre(this.value);
    return String(preRendered);
  }
}

declare module "../../types.js" {
  interface TemplateTags {
    unsafe: UnsafeTag;
  }
}