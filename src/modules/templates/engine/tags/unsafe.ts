import Tag from "../tag";

// eslint-disable-next-line @typescript-eslint/ban-types
export type UnsafeString = String & { __unsafe?: boolean };

export default class UnsafeTag extends Tag {
  static tagName = "unsafe";
  value: UnsafeString = "";

  init() {
    [this.value as UnsafeString] = this.args;
    this.selfClosing = true;
  }

  close() {
    const s: UnsafeString = new String(this.value);
    s.__unsafe = true;
    return s;
  }

  static create(value: UnsafeString) {
    return new this(value);
  }
}
