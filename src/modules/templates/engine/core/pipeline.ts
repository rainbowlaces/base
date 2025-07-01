import sanitizeHtml from 'sanitize-html';
import { type Renderable, RawHTML, isRenderable } from './renderable';
import { TemplateBuffer } from './buffer';
import { HtmlValidator } from './validation';
import { DEFAULT_TEMPLATE_CONFIG } from '../../config/templateConfig';
import { BaseLogger } from '../../../../core/logger/baseLogger';

/**
 * Represents a rendered value with safety information.
 * This is used in Stage 1 of the pipeline.
 */
export interface RenderedValue {
  value: string;
  safe: boolean;
}

/**
 * The multi-stage rendering pipeline that implements the Template Engine 2.0 spec.
 * 
 * Stage 1: Pre-render → Promise<RenderedValue[]>
 * Stage 2: Merge adjacent safe:true chunks
 * Stage 3: Sanitize & Join
 * Stage 4: Validation (parse5)
 */
export class RenderingPipeline {
  private readonly buffer: TemplateBuffer;
  private readonly validator: HtmlValidator;
  private readonly logger: BaseLogger;
  private readonly validateHtml: boolean;

  constructor(
    bufferLimitMB: number = DEFAULT_TEMPLATE_CONFIG.bufferLimitMB,
    validateHtml: boolean = DEFAULT_TEMPLATE_CONFIG.validateHtml
  ) {
    this.buffer = new TemplateBuffer(bufferLimitMB);
    this.validator = new HtmlValidator();
    this.logger = new BaseLogger('TemplateEngine', ['template']);
    this.validateHtml = validateHtml;
  }

  /**
   * Main render method that orchestrates the 4-stage pipeline.
   */
  public async render(renderable: Renderable): Promise<string> {
    try {
      this.buffer.reset();
      
      // Stage 1: Pre-render
      const preRendered = await this.stage1PreRender(renderable);
      
      // Stage 2: Merge adjacent safe chunks
      const merged = this.stage2MergeChunks(preRendered);
      
      // Stage 3: Sanitize & Join
      const sanitized = await this.stage3SanitizeAndJoin(merged);
      
      // Stage 4: Validation (optional)
      const validated = this.validateHtml ? this.stage4Validate(sanitized) : sanitized;
      
      return validated;
    } catch (error) {
      this.logger.error('Template rendering failed', [String(error)]);
      throw error;
    }
  }

  /**
   * Stage 1: Pre-render to RenderedValue[]
   * Recursively processes Renderable objects and creates value/safety pairs.
   */
  private async stage1PreRender(renderable: Renderable): Promise<RenderedValue[]> {
    const preRendered = await renderable.callPre();
    
    if (Array.isArray(preRendered)) {
      const results: RenderedValue[] = [];
      for (const item of preRendered) {
        const itemResults = await this.renderItem(item);
        results.push(...itemResults);
      }
      return results;
    }
    
    return this.renderItem(preRendered);
  }

  /**
   * Process a single item into RenderedValue(s).
   */
  private async renderItem(item: unknown): Promise<RenderedValue[]> {
    const resolvedItem = await item;
    
    // RawHTML is marked as safe (no sanitization needed)
    if (resolvedItem instanceof RawHTML) {
      return [{ value: String(resolvedItem.content), safe: true }];
    }
    
    // Nested Renderable objects
    if (isRenderable(resolvedItem)) {
      return this.stage1PreRender(resolvedItem);
    }
    
    // All other values are unsafe and need sanitization
    return [{ value: String(resolvedItem), safe: false }];
  }

  /**
   * Stage 2: Merge adjacent safe:true chunks for efficiency.
   */
  private stage2MergeChunks(values: RenderedValue[]): RenderedValue[] {
    if (values.length === 0) return values;
    
    const merged: RenderedValue[] = [];
    let current = values[0];
    
    for (let i = 1; i < values.length; i++) {
      const next = values[i];
      
      // Merge adjacent safe chunks
      if (current.safe && next.safe) {
        current = { value: current.value + next.value, safe: true };
      } else {
        merged.push(current);
        current = next;
      }
    }
    
    merged.push(current);
    return merged;
  }

  /**
   * Stage 3: Sanitize unsafe chunks and join all.
   */
  private async stage3SanitizeAndJoin(values: RenderedValue[]): Promise<string> {
    let result = '';
    
    for (const item of values) {
      let content: string;
      
      if (item.safe) {
        content = item.value;
      } else {
        // Sanitize unsafe content
        content = sanitizeHtml(item.value, { allowedTags: [] });
        content = this.htmlEscape(content);
      }
      
      // Check buffer capacity before adding
      this.buffer.checkCapacity(content);
      result += content;
      this.buffer.add(content);
    }
    
    return result;
  }

  /**
   * Stage 4: HTML validation and dangerous attribute/URL removal.
   */
  private stage4Validate(html: string): string {
    try {
      return this.validator.validate(html);
    } catch (error) {
      this.logger.error('HTML validation failed', [String(error), html.substring(0, 100)]);
      throw error;
    }
  }

  /**
   * HTML escape utility for additional security.
   */
  private htmlEscape(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/:/g, "&#58;")
      .replace(/=/g, "&#61;");
  }
}
