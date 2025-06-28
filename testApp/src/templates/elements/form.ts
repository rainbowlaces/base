import { html } from "../../../../src/index";

export default (d: any, _t: any, e: any) =>
  html` ${e.page({
    context: d.context,
    title: d.title,
    page: html`
      <form action="${d.action ?? ""}" method="${d.method ?? "post"}">
        ${d.fields}
        <div>
          <button type="submit">${d.button}</button>
        </div>
      </form>
    `,
  })}`;
