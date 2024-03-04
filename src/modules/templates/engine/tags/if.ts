import Tag from "../tag";

export default class IfTag extends Tag {
  static tagName = "if";
  condition: boolean = false;

  init() {
    [this.condition] = this.args;
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
