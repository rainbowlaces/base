import { Tag } from "../tag";

export class EachTag extends Tag {
  static tagName = "each";
  iterable: Iterable<unknown> = [];
  templateFunction: (item: unknown) => string = () => "";

  init() {
    [this.iterable, this.templateFunction] = this.args;
    this.selfClosing = true;
  }

  close() {
    return Array.from(this.iterable)
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
