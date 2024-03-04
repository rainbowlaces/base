/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable node/no-unpublished-import */
import * as sinon from "sinon";

import prettier from "prettier";
import { JSDOM } from "jsdom";

export async function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function getPrivate(obj: any, prop: string) {
  return obj[prop];
}

export function setPrivate(obj: any, prop: string, value: any) {
  obj[prop] = value;
}

export function getMock<T extends object>(Klass: new (...args: any[]) => T): T {
  return sinon.stub(
    //@ts-expect-error overriding the base constructor
    new (class extends Klass {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(...args: any[]) {
        super();
      }
    })(),
  ) as T;
}

export function matchIsoTimestamp(time: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  return !!time.match(regex);
}

export async function normalizeForDiff(html: string): Promise<string> {
  const ignoreTags = ["script", "style", "svg"];
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Function to recursively remove specified tags
  function removeTags(node: Node) {
    // Only proceed if node is an element (to safely access .tagName)
    if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
      const element = node as Element;
      if (ignoreTags.includes(element.tagName.toLowerCase())) {
        element.parentNode?.removeChild(element);
        return;
      }
      Array.from(element.childNodes).forEach(removeTags);
    }
  }

  // Normalize whitespace
  function normalizeWhitespace(node: Node) {
    if (node.nodeType === dom.window.Node.TEXT_NODE) {
      // Directly modify the text node's value
      if (node.nodeType === dom.window.Node.TEXT_NODE) {
        // If nodeValue is undefined, fallback to an empty string before replacing and trimming
        node.nodeValue = node.nodeValue?.replace(/\s+/g, " ").trim() ?? null;
      }
    } else if (node.nodeType === dom.window.Node.ELEMENT_NODE) {
      // Recursively normalize whitespace in child nodes
      Array.from(node.childNodes).forEach(normalizeWhitespace);
    }
  }

  // Start normalization process
  removeTags(document.body);
  normalizeWhitespace(document.body);

  // Serialize and return normalized HTML
  return prettier.format(dom.serialize(), { parser: "html" });
}

export function normalizeWhitespace(html: string): string {
  return html.replace(/\s+/g, " ").trim();
}
