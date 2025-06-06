import { readdir } from "node:fs/promises";
import { TemplateResult } from "./render";
import Tag from "./tag";
import tags from "./tags";
import path from "path";

type Scalar = string | number | boolean | null;

export interface TemplateData {
  [key: string]: Scalar | Scalar[] | TemplateData | TemplateData[];
}

export type LoadedTags = { [key: string]: (...args: unknown[]) => Tag };
export type LoadedElements = { [key: string]: ElementFunction };

type LoadedTemplates = { [key: string]: TemplateFunction };
type TemplateFunction = (
  data: TemplateData,
  tags: LoadedTags,
  elements: LoadedElements,
) => TemplateResult;

type ElementFunction = (
  data: TemplateData,
  tags?: LoadedTags,
  elements?: LoadedElements,
) => TemplateResult;

class Template {
  private root: string;
  public _tags: LoadedTags;
  public _elements: LoadedElements;
  public _templates: LoadedTemplates;

  constructor(templateRoot: string) {
    this._tags = {};
    this._elements = {};
    this._templates = {};

    this.root = path.resolve(templateRoot);
  }

  async init() {
    await this.loadTemplates();
    await this.loadElements();
    await this.loadTags();
  }

  public registerTag(TagClass: typeof Tag): void {
    this._tags[TagClass.tagName] = (...args: unknown[]) => {
      const tag = new TagClass(...args);
      tag.init();
      if (tag.selfClosing) tag.closed = true;
      return tag;
    };
  }

  private async loadTags() {
    // register tags
    tags.forEach((TagClass: typeof Tag) => this.registerTag(TagClass));
  }

  private async loadElements() {
    // load elements
    const elementPath = path.resolve(path.join(this.root, "elements"));

    let elementFiles: string[] = [];
    try {
      elementFiles = await readdir(elementPath);
    } catch (e) {
      elementFiles = [];
    }

    if (!elementFiles.length) return;

    for (const file of elementFiles) {
      if (path.extname(file) === ".js") {
        const elementName = path.basename(file).replace(".js", "");
        const elem = await this.loadElement(elementName);
        this._elements[elementName] = (data: TemplateData): TemplateResult => {
          return elem(data, this._tags, this._elements);
        };
      }
    }
  }

  private async loadElement(element: string): Promise<ElementFunction> {
    const p = path.resolve(path.join(this.root, "elements", `${element}.js`));
    return import(p).then((element) => element.default as ElementFunction);
  }

  private async loadTemplates() {
    // load templates
    const templatePath = path.resolve(path.join(this.root));
    const templateFiles = await readdir(templatePath);

    for (const file of templateFiles) {
      if (path.extname(file) === ".js") {
        const templateName = path.basename(file).replace(".js", "");
        this._templates[templateName] = await this.loadTemplate(templateName);
      }
    }
  }

  private async loadTemplate(template: string): Promise<TemplateFunction> {
    const p = path.resolve(path.join(this.root, `${template}.js`));
    return import(p).then((template) => template.default as TemplateFunction);
  }

  public getElement(element: string): ElementFunction {
    return this._elements[element];
  }

  public render(templateName: string, data: TemplateData): string {
    const result = this._templates[templateName](
      data,
      this._tags,
      this._elements,
    );
    return result.render();
  }
}

function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): TemplateResult {
  return new TemplateResult(Array.from(strings), values);
}

export { html, Template, TemplateResult };
