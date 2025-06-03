import sanitizeHtml from "sanitize-html";
import Tag from "./tag";
import { UnsafeString } from "./tags/unsafe";

export class TemplateResult {
  public readonly content: string;
  public readonly isTemplateResult = true;

  constructor(content: string) {
    this.content = content;
  }

  toString(): string {
    return this.content;
  }
}

export class TemplateElement extends TemplateResult {
  public readonly isTemplateElement = true;

  constructor(content: string) {
    super(content);
  }
}

// Type guards
function isTemplateResult(value: unknown): value is TemplateResult {
  return value instanceof TemplateResult;
}

function isTemplateElement(value: unknown): value is TemplateElement {
  return value instanceof TemplateElement;
}

export default class Render {
  private root: Tag;
  private stack: Tag[];
  private data: unknown[];

  constructor(strings: TemplateStringsArray, values: unknown[]) {
    this.root = new Tag();
    this.stack = [];
    this.data = this._interleave(strings, values);
    this.newContext(this.root);
  }

  get context(): Tag {
    return this.stack.length > 0
      ? this.stack[this.stack.length - 1]
      : this.root;
  }

  private _interleave(
    strings: TemplateStringsArray,
    values: unknown[],
  ): unknown[] {
    const result: unknown[] = [];
    let current: string = "";

    function addValue(val: unknown) {
      if (val instanceof Tag) {
        if (current.length > 0) result.push(current);
        result.push(val);
        current = "";
      } else if (isTemplateElement(val)) {
        // Template elements are trusted (like elements), add as-is
        if (current.length > 0) result.push(current);
        result.push(val);
        current = "";
      } else if (isTemplateResult(val)) {
        // Template results are trusted - they contain already-sanitized content
        if (current.length > 0) result.push(current);
        result.push(val);
        current = "";
      } else if ((val as UnsafeString)?.__unsafe) {
        // Legacy unsafe strings
        if (current.length > 0) result.push(current);
        result.push(val);
        current = "";
      } else if (val) {
        current += val;
      }
    }

    for (let i = 0; i < strings.length; i++) {
      addValue(strings[i]);
      if (i < values.length) {
        addValue(
          values[i] instanceof Tag
            ? values[i]
            : isTemplateElement(values[i])
              ? values[i]
              : isTemplateResult(values[i])
                ? values[i]
                : (values[i] as UnsafeString)?.__unsafe
                  ? values[i]
                  : sanitizeHtml(values[i] as string, { allowedTags: [] }),
        );
      }
    }

    if (current.length > 0) result.push(current);

    return result;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  public render(): String {
    this.data.forEach((value) => {
      if (value instanceof Tag) {
        if (value.isBlock()) {
          this.newContext(value);
          return;
        }
      }

      if (Array.isArray(value)) {
        value = value.join("");
      }

      // Handle template results and elements
      if (isTemplateResult(value)) {
        value = value.toString();
      }

      this.context.process(value);
      if (this.context.isClosed()) this.lastContext();
    });
    return this.root.close();
  }

  private newContext(tag: Tag): void {
    this.stack.push(tag);
  }

  private lastContext(): void {
    const currentContext = this.stack.pop();
    if (!currentContext) return;
    this.context.process(currentContext.getOutput());
  }
}
