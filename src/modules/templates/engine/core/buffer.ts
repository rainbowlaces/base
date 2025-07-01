import { TemplateBufferExceededError } from "./errors";

/**
 * Manages memory safeguards for template rendering.
 * Tracks buffer size and throws errors when limits are exceeded.
 */
export class TemplateBuffer {
  private currentSizeBytes = 0;
  private readonly limitBytes: number;

  constructor(limitMB: number = 8) {
    this.limitBytes = limitMB * 1024 * 1024; // Convert MB to bytes
  }

  /**
   * Check if adding the specified content would exceed the buffer limit.
   * @param content The content to check
   * @throws TemplateBufferExceededError if limit would be exceeded
   */
  checkCapacity(content: string): void {
    const contentSize = Buffer.byteLength(content, 'utf8');
    const newSize = this.currentSizeBytes + contentSize;
    
    if (newSize > this.limitBytes) {
      const currentMB = this.currentSizeBytes / (1024 * 1024);
      const limitMB = this.limitBytes / (1024 * 1024);
      throw new TemplateBufferExceededError(currentMB, limitMB);
    }
  }

  /**
   * Add content to the buffer, checking capacity first.
   * @param content The content to add
   * @throws TemplateBufferExceededError if limit would be exceeded
   */
  add(content: string): void {
    this.checkCapacity(content);
    this.currentSizeBytes += Buffer.byteLength(content, 'utf8');
  }

  /**
   * Get the current buffer size in megabytes.
   */
  getCurrentSizeMB(): number {
    return this.currentSizeBytes / (1024 * 1024);
  }

  /**
   * Get the buffer limit in megabytes.
   */
  getLimitMB(): number {
    return this.limitBytes / (1024 * 1024);
  }

  /**
   * Reset the buffer size counter.
   */
  reset(): void {
    this.currentSizeBytes = 0;
  }
}
