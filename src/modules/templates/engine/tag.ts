/* eslint-disable @typescript-eslint/no-explicit-any */
import { nanoid } from "nanoid";
import { Template, TemplateResult } from ".";
import sanitizeHtml from "sanitize-html";
import { TemplateValue } from "./render";

export class Tag {
  closed: boolean;
  selfClosing: boolean;
  unsafe = false; // For tags that should not be sanitized
  args: any[];
  content: string[];
  output: string;
  template?: Template;

  id: string = nanoid(8);

  static tagName: string;

  // final
  constructor(...args: any[]) {
    this.args = args;
    this.content = [];
    this.output = "";
    this.selfClosing = false;
    this.closed = false;
  }

  // final
  isBlock() {
    return !this.selfClosing;
  }

  // final
  isClosed() {
    return this.closed;
  }

  // override in children
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  init() {}

  // override in children
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  open() {}

  // override in children
  inside(content: string) {
    this.content.push(content || "");
  }

  // override in children
  close(): string {
    return this.content.join("").trim();
  }

  // final
  process(tv: TemplateValue): string | null {
    const v = tv.value;
    if (!this.content.length) this.open();

    if (!this.isBlock()) {
      // Self-closing tag: capture its output
      this.output = this.close();
      return this.output;
    }

    if (v instanceof EndTag) {
      this.closed = true;
      this.output = this.close();
      return this.output;
    }

    if (v instanceof Tag) {
      // If block, push new context; if self-closing, open/close immediately
      if (v.isBlock()) {
        v.open();
        return null;
      } else {
        v.open();
        const text = v.close();
        // Sanitize if this tag is not marked unsafe
        return v.unsafe ? text : sanitizeHtml(text, { allowedTags: [] });
      }
    }

    if (v instanceof TemplateResult) {
      // Render the TemplateResult independently to avoid tag stack corruption
      const rendered = v.render();
      this.inside(rendered);
      return null;
    }

    // Primitive or string: sanitize only if not from literal
    const raw = String(v ?? "");
    const content = tv.fromLiteral ? raw : this.sanitize(raw);
    this.inside(content);
    return null;
  }

  private sanitize(content: string): string {
    if (this.unsafe) return content;
    content = sanitizeHtml(content, { allowedTags: [] });
    content = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/:/g, "&#58;")
      .replace(/=/g, "&#61;");
    return content;
  }

  // final
  getOutput() {
    return this.output;
  }
}

export class EndTag extends Tag {
  static tagName = "end";

  init() {
    this.selfClosing = true;
  }

  static create() {
    return new EndTag();
  }
}
