/**
 * Represents a value that can be safely rendered without additional sanitization.
 * This is an internal type - the RawHTML wrapper should only be used within the engine.
 */
export class RawHTML {
  constructor(public readonly content: unknown) {}
}

/**
 * A type guard to check if a value is a Renderable object.
 */
function isRenderable(value: unknown): value is Renderable {
  return value != null && typeof (value as Renderable).render === 'function';
}

/**
 * The abstract base class for anything that can be rendered into a string.
 * This version follows the new spec with protected readonly value and no-arg pre().
 */
export abstract class Renderable<T = unknown> {
  protected readonly value: T;

  constructor(value: T) {
    this.value = value;
  }

  /**
   * Main render method that delegates to the pipeline.
   * This is the public API entry point.
   */
  public async render(): Promise<string> {
    // Import here to avoid circular dependency
    const { RenderingPipeline } = await import('./pipeline');
    const pipeline = new RenderingPipeline();
    return pipeline.render(this);
  }

  /**
   * Pre-processing stage that transforms the value before rendering.
   * No arguments - works with the protected readonly value.
   */
  protected abstract pre(): Promise<unknown>;

  /**
   * Post-processing stage for final string transformations.
   * Default implementation returns the value unchanged.
   */
  protected post(value: string): string {
    return value;
  }

  /**
   * Get the current value (for pipeline access).
   * @internal
   */
  public getValue(): T {
    return this.value;
  }

  /**
   * Call the pre-processing method (for pipeline access).
   * @internal
   */
  public async callPre(): Promise<unknown> {
    return this.pre();
  }

  /**
   * Call the post-processing method (for pipeline access).
   * @internal
   */
  public callPost(value: string): string {
    return this.post(value);
  }
}

// Re-export the utility functions
export { isRenderable };
