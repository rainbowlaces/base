import Tag from "../tag";

export default class IfTag extends Tag {
  static tagName = "if";
  condition = false;

  init() {
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
