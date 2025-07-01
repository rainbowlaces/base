import sanitizeHtml from "sanitize-html";

// --- Type Guards and Helper Types ---

/**
 * A special wrapper class to signal that its content should be rendered as-is,
 * bypassing the default HTML sanitization. Use with extreme caution.
 */
export class RawHTML {
  constructor(public readonly content: unknown) {}
}

/**
 * A type guard to check if a value is a Renderable object.
 * @param value The value to check.
 * @returns True if the value has a .render() method.
 */
function isRenderable(value: unknown): value is Renderable {
  return value != null && typeof (value as Renderable).render === 'function';
}


/**
 * The abstract base class for anything that can be rendered into a string.
 * This version is fully asynchronous and has been refactored to be more secure
 * and robust in its handling of values.
 */
export abstract class Renderable<T = unknown> {
  readonly #value: T;

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
    const preRendered = await this.pre(this.#value);

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

    // The "unsafe" check is now isolated to this specific wrapper type.
    // It no longer leaks to other items in the render pipeline.
    if (resolvedItem instanceof RawHTML) {
      return String(resolvedItem.content);
    }

    if (isRenderable(resolvedItem)) {
      return resolvedItem.render();
    }

    // By default, all non-Renderable values are sanitized.
    const sanitized = this.#sanitize(String(resolvedItem));
    return this.post(sanitized);
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  protected abstract pre(value: T): Promise<unknown> | unknown;

  protected post(value: string): string {
   return value;
  }

  constructor(value: T) {
    this.#value = value;
  }
}

/**
 * A specific Renderable for wrapping primitive or promised values from templates.
 * It now handles object types more intelligently than a simple JSON.stringify.
 */
export class TemplateValue extends Renderable {
    #isLiteral: boolean;

    constructor(value: unknown, isLiteral: boolean) {
        super(value);
        this.#isLiteral = isLiteral;
    }

    async pre(value: unknown): Promise<unknown> {
        const resolvedValue = await value;
        
        // Literal strings from the template are considered safe and are wrapped in RawHTML.
        if (this.#isLiteral) {
            return new RawHTML(resolvedValue);
        }

        if (resolvedValue === null || resolvedValue === undefined) {
            return "";
        }

        // Smarter object handling
        if (typeof resolvedValue === 'object') {
            // Use .toString() for Dates, etc., but avoid the generic [object Object].
            if (resolvedValue.toString !== Object.prototype.toString) {
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                return String(resolvedValue);
            }
            // For plain objects, JSON.stringify is a reasonable, if imperfect, default.
            // A more advanced implementation might use a custom serializer registry.
            try {
                return JSON.stringify(resolvedValue);
            } catch {
                return '[Unserializable Object]';
            }
        }
        
        return resolvedValue;
    }
}

/**
 * The async-aware base class for all logic tags.
 */
export abstract class Tag<T = unknown, P extends object = object> extends Renderable<T> {
  protected readonly params: P;

  constructor(value: T, params: P) {
    super(value);
    this.params = params;
  }
}


// --- Concrete Tag Implementations ---

interface EachTagParams<I = unknown> {
  do: (item: I) => Renderable;
  else?: Renderable | string;
}

export class EachTag<TItem = unknown> extends Tag<Iterable<TItem> | Promise<Iterable<TItem>> | null | undefined, EachTagParams<TItem>> {
    async pre(value: Iterable<TItem> | Promise<Iterable<TItem>> | null | undefined): Promise<unknown> {
        const resolvedValue = await value;
        const items = resolvedValue ? Array.from(resolvedValue) : [];
        
        if (items.length === 0) {
            // Ensure the 'else' clause is treated as a literal if it's a string.
            return typeof this.params.else === 'string' 
                ? new RawHTML(this.params.else) 
                : (this.params.else ?? "");
        }
        return items.map(this.params.do);
    }
}

interface IfTagParams {
  then: Renderable;
  else?: Renderable | string;
}

export class IfTag extends Tag<boolean | Promise<boolean>, IfTagParams> {
    async pre(value: boolean | Promise<boolean>): Promise<unknown> {
        const condition = await value;
        if (condition) {
            return this.params.then;
        }
        // Ensure the 'else' clause is treated as a literal if it's a string.
        return typeof this.params.else === 'string' 
            ? new RawHTML(this.params.else) 
            : (this.params.else ?? "");
    }
}

export class UnsafeTag extends Tag {
    constructor(value: unknown) {
        super(value, {});
    }
    
    pre(value: unknown): unknown {
        // The UnsafeTag's only job is to wrap its value in RawHTML.
        return new RawHTML(value);
    }
}

/**
 * The container for the output of the `html` function.
 */
export class TemplateResult extends Renderable<Renderable[]> {
  pre(value: Renderable[]): Renderable[] {
    return value;
  }
}

/**
 * The tagged template literal function. It interleaves static strings and dynamic
 * values into a structured array of Renderable objects.
 */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): TemplateResult {
  const result: Renderable[] = [];
  
  // A tagged template has N strings and N-1 values.
  for (let i = 0; i < strings.length; i++) {
    result.push(new TemplateValue(strings[i], true));
    if (i < values.length) {
      const value = values[i];
      if (value instanceof Renderable) {
        result.push(value);
      } else {
        result.push(new TemplateValue(value, false));
      }
    }
  }

  return new TemplateResult(result);
}
