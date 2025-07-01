import { readdir } from "node:fs/promises";
import { TemplateResult } from "./render";
import { type Tag } from "./tag";
import { tags } from "./tags";
import path from "path";

// Removed restrictive TemplateData type - templates now accept any data

export type LoadedTags = Record<string, (...args: unknown[]) => Tag>;
export type LoadedElements = Record<string, ElementFunction>;

type LoadedTemplates = Record<string, TemplateFunction>;
type TemplateFunction = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Templates need to accept any data structure
  data: any,
  tags: LoadedTags,
  elements: LoadedElements,
) => TemplateResult;

type ElementFunction = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Templates need to accept any data structure
  data: any,
  tags?: LoadedTags,
  elements?: LoadedElements,
) => TemplateResult;

class Template {
  private root: string;
  public tags: LoadedTags;
  public elements: LoadedElements;
  public templates: LoadedTemplates;

  constructor() {
    this.tags = {};
    this.elements = {};
    this.templates = {};
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Templates need to accept any data structure
  public render(templateName: string, data: any): string {
    const result = this.templates[templateName](
      data,
      this.tags,
      this.elements,
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
