import { Tag } from "../tag";

export class UnsafeTag extends Tag {
  static tagName = "unsafe";
  unsafe = true; // This tag is unsafe and should not be sanitized
  value: unknown;

  init() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    [this.value] = this.args;
    this.selfClosing = true;
  }

  close() {
    return String(this.value);
  }

  static create(value: unknown) {
    return new this(value);
  }
}
