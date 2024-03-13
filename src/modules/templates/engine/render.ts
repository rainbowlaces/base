import sanitizeHtml from "sanitize-html";
import Tag from "./tag";
import { UnsafeString } from "./tags/unsafe";

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
            : (values[i] as UnsafeString)?.__unsafe
              ? values[i]
              : sanitizeHtml(values[i] as string),
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
