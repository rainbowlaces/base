/* eslint-disable @typescript-eslint/no-explicit-any */
import { html } from "../../../modules/templates/engine";

export default (d: any, t: any, e: any) => html`
  ${e.form({
    context: d,
    title: "Forgotten password",
    button: "Reset password",
    action: "/auth/reset",
    intro: html`If you have forgotten your password, please enter your email
    address below and we will send you a link to reset your password.`,
    fields: html`<input
      value="${d.email || ""}"
      name="email"
      type="email"
      label="Email"
    ></input>`,
  })}
`;
