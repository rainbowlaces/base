import { html } from "../../../modules/templates/engine";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default (d: any, t: any, e: any) => html`
  <html>
    ${e.head({ title: "Home" })}
    <body>
      <div main>
        <h1>Home</h1>
        <p>Welcome to the home page!</p>
      </div>
    </body>
  </html>
`;
