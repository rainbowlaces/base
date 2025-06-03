/* eslint-disable @typescript-eslint/no-explicit-any */
import { html } from "../../../../modules/templates/engine";

export default (d: any, t: any, e: any) =>
  html` ${e.page({
    context: d.context,
    title: d.title,
    page: html`
      <form action="${d.action || ""}" method="${d.method || "post"}">
        ${t.unsafe(d.fields)}
        <div>
          <button type="submit">${d.button}</button>
        </div>
      </form>
    `,
  })}`;
