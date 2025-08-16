import sanitizeHtml from "sanitize-html";
import { type MaybeAsync } from "../types.js";

/**
 * A type guard to check if a value is a Renderable object.
 * @param value The value to check.
 * @returns True if the value has a .render() method.
 */
export function isRenderable(value: unknown): value is Renderable {
  return value != null && typeof (value as Renderable).render === 'function';
}

/**
 * The abstract base class for anything that can be rendered into a string.
 * This version is fully asynchronous and sanitizes all content by default.
 * Only UnsafeTag can bypass sanitization.
 */
export abstract class Renderable<T = MaybeAsync<unknown>> {
  readonly #value: T;

  protected get value(): T {
    return this.#value;
  }

  #sanitize(content: string): string {
    content = sanitizeHtml(content, { allowedTags: [] });
    return content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/:/g, "&#58;")
      .replace(/=/g, "&#61;");
  }

  public async render(): Promise<string> {
    const preRendered = await this.pre(await this.#value);

    if (Array.isArray(preRendered)) {
      const renderedItems = await Promise.all(
        preRendered.map(item => this.renderItem(item))
      );
      return renderedItems.join("");
    }

    return this.renderItem(preRendered);
  }

  private async renderItem(item: unknown): Promise<string> {
    const resolvedItem = await item;

    if (isRenderable(resolvedItem)) {
      return resolvedItem.render();
    }

    // By default, all values are sanitized
    const sanitized = this.#sanitize(String(resolvedItem));
    return this.post(sanitized);
  }

  protected pre(value: T): MaybeAsync<unknown> {
    return value
  }

  protected post(value: string): string {
    return value;
  }

  constructor(value: T) {
    this.#value = value;
  }
}
