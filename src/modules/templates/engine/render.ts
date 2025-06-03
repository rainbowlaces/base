import Tag, { EndTag } from "./tag";

export class TemplateValue {
  constructor(
    readonly value: unknown | Tag | TemplateResult,
    readonly fromLiteral: boolean = false,
  ) {}

  render(renderer: TagRenderer): void {
    const content = renderer.getCurrentContext().process(this);
    if (typeof content === "string") {
      renderer.getCurrentContext().inside(content);
    }
  }
}
export class TemplateResult {
  public readonly values: TemplateValue[] = [];
  private _rendered: string | null = null;

  constructor(strings: string[], values: unknown[]) {
    const len = Math.max(strings.length, values.length);
    for (let i = 0; i < len; i++) {
      if (i < strings.length) {
        this.values.push(new TemplateValue(strings[i], true));
      }
      if (i < values.length) {
        this.values.push(new TemplateValue(values[i]));
      }
    }
  }

  render(): string {
    const renderer = new TagRenderer();
    this._rendered = renderer.renderAll(this.values);
    return this._rendered;
  }

  toString(): string {
    return this._rendered ?? "";
  }
}

export class TagRenderer {
  private stack: Tag[] = [];
  private root: Tag;

  constructor() {
    this.root = new Tag();
    this.stack.push(this.root);
    this.root.open();
  }

  getCurrentContext(): Tag {
    return this.stack[this.stack.length - 1];
  }

  renderAll(values: TemplateValue[]): string {
    for (const tv of values) {
      const current = this.getCurrentContext();
      const result = current.process(tv);
      if (typeof result === "string") {
        this.getCurrentContext().inside(result);
      }
      if (tv.value instanceof Tag) {
        if (tv.value instanceof EndTag) {
          this.stack.pop();
        } else if (tv.value.isBlock()) {
          this.stack.push(tv.value);
          tv.value.open();
        }
      }
    }
    return this.finalize();
  }

  finalize(): string {
    if (this.stack.length > 1) {
      throw new Error(`Unclosed tags remain: ${this.stack.length - 1}`);
    }
    return this.root.close();
  }
}
