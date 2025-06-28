import { Tag } from "../tag";

export class IfTag extends Tag {
  static tagName = "if";
  condition = false;

  init() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    [this.condition] = this.args;
    this.selfClosing = false; // Make sure this is a block tag
  }

  close() {
    if (this.condition) {
      return this.content.join("").trim();
    } else {
      return "";
    }
  }

  static create(condition: boolean) {
    return new IfTag(condition);
  }
}
