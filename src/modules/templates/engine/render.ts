import sanitizeHtml from "sanitize-html";

export class TemplateValue {
  constructor(
    readonly value: unknown,
    readonly fromLiteral = false,
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
  private rendered: string | null = null;

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
    this.rendered = renderer.renderAll(this.values);
    return this.rendered;
  }

  toString(): string {
    return this.rendered ?? "";
  }
}
