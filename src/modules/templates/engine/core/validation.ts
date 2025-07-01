import { parse } from 'parse5';
import type { Document, Element, TextNode, Node } from 'parse5/dist/tree-adapters/default';
import { TemplateValidationError } from './errors';

// Type for parse5 attributes since it's not properly exported
interface ParseAttribute {
  name: string;
  value: string;
}

/**
 * HTML validator that strips dangerous attributes and URL schemes.
 * This is Stage 4 of the rendering pipeline.
 */
export class HtmlValidator {
  private readonly dangerousAttributes = new Set([
    'onabort', 'onactivate', 'onafterprint', 'onafterupdate', 'onbeforeactivate',
    'onbeforecopy', 'onbeforecut', 'onbeforedeactivate', 'onbeforeeditfocus',
    'onbeforepaste', 'onbeforeprint', 'onbeforeunload', 'onbeforeupdate',
    'onblur', 'onbounce', 'oncellchange', 'onchange', 'onclick', 'oncontextmenu',
    'oncontrolselect', 'oncopy', 'oncut', 'ondataavailable', 'ondatasetchanged',
    'ondatasetcomplete', 'ondblclick', 'ondeactivate', 'ondrag', 'ondragend',
    'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop',
    'onerror', 'onerrorupdate', 'onfilterchange', 'onfinish', 'onfocus',
    'onfocusin', 'onfocusout', 'onhelp', 'onkeydown', 'onkeypress', 'onkeyup',
    'onlayoutcomplete', 'onload', 'onlosecapture', 'onmousedown', 'onmouseenter',
    'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup',
    'onmousewheel', 'onmove', 'onmoveend', 'onmovestart', 'onpaste',
    'onpropertychange', 'onreadystatechange', 'onreset', 'onresize',
    'onresizeend', 'onresizestart', 'onrowenter', 'onrowexit', 'onrowsdelete',
    'onrowsinserted', 'onscroll', 'onselect', 'onselectionchange', 'onselectstart',
    'onstart', 'onstop', 'onsubmit', 'onunload'
  ]);

  private readonly dangerousSchemes = new Set([
    'javascript:', 'data:', 'vbscript:', 'blob:', 'file:'
  ]);

  /**
   * Validate and clean HTML content.
   * @param html The HTML content to validate
   * @returns Cleaned HTML content
   * @throws TemplateValidationError if parsing fails
   */
  validate(html: string): string {
    try {
      const document = parse(html);
      this.cleanDocument(document);
      return this.serializeDocument(document);
    } catch (error) {
      throw new TemplateValidationError('Failed to parse HTML', error);
    }
  }

  private cleanDocument(document: Document): void {
    this.walkNodes(document, (node) => {
      if (this.isElement(node)) {
        this.cleanElement(node);
      }
    });
  }

  private cleanElement(element: Element): void {
    // Remove dangerous event handler attributes
    element.attrs = element.attrs.filter(attr => 
      !this.dangerousAttributes.has(attr.name.toLowerCase())
    );

    // Clean dangerous URL schemes from href and src attributes
    element.attrs.forEach(attr => {
      if (['href', 'src', 'action', 'formaction'].includes(attr.name.toLowerCase())) {
        attr.value = this.cleanUrl(attr.value);
      }
    });
  }

  private cleanUrl(url: string): string {
    const cleanUrl = url.trim().toLowerCase();
    
    for (const scheme of this.dangerousSchemes) {
      if (cleanUrl.startsWith(scheme)) {
        return '#'; // Replace with safe anchor
      }
    }
    
    return url; // Return original if safe
  }

  private walkNodes(node: Node, callback: (node: Node) => void): void {
    callback(node);
    
    if ('childNodes' in node) {
      for (const child of node.childNodes) {
        this.walkNodes(child, callback);
      }
    }
  }

  private isElement(node: Node): node is Element {
    return 'tagName' in node && 'attrs' in node;
  }

  private isTextNode(node: Node): node is TextNode {
    return node.nodeName === '#text';
  }

  private serializeDocument(document: Document): string {
    // For simplicity, just return the inner content
    // In a full implementation, you'd use parse5's serializer
    return this.serializeNodes(document.childNodes);
  }

  private serializeNodes(nodes: Node[]): string {
    return nodes.map(node => this.serializeNode(node)).join('');
  }

  private serializeNode(node: Node): string {
    if (this.isTextNode(node)) {
      return node.value;
    }
    
    if (this.isElement(node)) {
      const attrs = node.attrs
        .map((attr: ParseAttribute) => `${attr.name}="${attr.value}"`)
        .join(' ');
      
      const attrsStr = attrs ? ` ${attrs}` : '';
      
      if (node.childNodes.length === 0) {
        return `<${node.tagName}${attrsStr} />`;
      }
      
      const children = this.serializeNodes(node.childNodes);
      return `<${node.tagName}${attrsStr}>${children}</${node.tagName}>`;
    }
    
    return '';
  }
}
