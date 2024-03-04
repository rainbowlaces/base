import Tag from "../tag";

export default class EachTag extends Tag {
  static tagName = "each";
  iterable: unknown[] = [];
  templateFunction: (item: unknown) => string = () => "";

  init() {
    [this.iterable, this.templateFunction] = this.args;
    this.selfClosing = true;
  }

  close() {
    return this.iterable
      .map((item: unknown) => this.templateFunction(item))
      .join("");
  }

  static create(
    iterable: Iterable<unknown>,
    templateFunction: (item: unknown) => string,
  ) {
    return new EachTag(iterable, templateFunction);
  }
}
