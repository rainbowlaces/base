/* eslint-disable @typescript-eslint/no-explicit-any */
import { html } from "../../../../../index";

export default (d: any, t: any) => html`XX${"&<>"}XX${t.unsafe("&<>")}XX`;
