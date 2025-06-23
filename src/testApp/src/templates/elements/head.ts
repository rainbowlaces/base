/* eslint-disable @typescript-eslint/no-explicit-any */
import { html } from "../../../../modules/templates/engine";

export const headTemplate = (d: any) => html`
  <head>
    <title>${d.title}</title>
  </head>
`;
