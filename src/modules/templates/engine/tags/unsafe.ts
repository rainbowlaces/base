import Tag from "../tag";

export default class UnsafeTag extends Tag {
  static tagName = "unsafe";
  unsafe: boolean = true; // This tag is unsafe and should not be sanitized
  value: unknown;

  init() {
    [this.value as unknown] = this.args;
    this.selfClosing = true;
  }

  close() {
    return String(this.value);
  }

  static create(value: unknown) {
    return new this(value);
  }
}
