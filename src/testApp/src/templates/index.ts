/* eslint-disable @typescript-eslint/no-explicit-any */
import { html } from "../../../modules/templates/engine";

export default (d: any, t: any, e: any) => html`
  ${e.page({
    context: d.context,
    title: "Home",
    message: d.message,
    noGrid: true,
    page: html`<h1>Welcome!</h1>
      <p>You are awesome. ${d.message}</p> `,
  })}
`;
