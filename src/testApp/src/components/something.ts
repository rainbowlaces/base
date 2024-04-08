/* eslint-disable import/extensions */
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("test-header")
export class MyElement extends LitElement {
  @property({ type: Number })
  accessor level = 1;

  static styles = css`
    h1 {
      font-family: "Open Sans", sans-serif;
      font-optical-sizing: auto;
      font-style: normal;
      line-height: 130%;
      font-weight: 700;
    }
    h1[level="1"] {
      font-size: 47px;
    }
    h1[level="2"] {
      font-size: 23px;
    }
    h1[level="3"] {
      font-size: 18px;
    }
  `;

  render() {
    return html`<h1 level=${this.level} test><slot></slot></h1>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "test-header": MyElement;
  }
}
