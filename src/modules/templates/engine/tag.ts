/* eslint-disable @typescript-eslint/no-explicit-any */
import { Template } from ".";

export default class Tag {
  closed: boolean;
  selfClosing: boolean;
  args: any[];
  content: string[];
  output: string;
  template?: Template;

  id: string = (Math.random() * 10000).toFixed(0);

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
  init() {}

  // override in children
  open() {}

  // override in children
  inside(content: string) {
    this.content.push(content || "");
  }

  // override in children
  close() {
    return this.content.join("").trim();
  }

  // final
  process(value: EndTag | Tag | unknown = "") {
    if (!this.content.length) this.open();
    if (!this.isBlock()) {
      this.output = this.close();
      return;
    }

    if (value instanceof EndTag) {
      this.closed = true;
      this.output = this.close();
    } else {
      if (value instanceof Tag) {
        value.process();
        value = value.getOutput();
      }
      this.inside(value as string);
    }
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
