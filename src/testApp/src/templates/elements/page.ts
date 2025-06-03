/* eslint-disable @typescript-eslint/no-explicit-any */
import { html } from "../../../../modules/templates/engine";

export default (d: any, t: any, e: any) => {
  return html` <!doctype html>
    <html lang="en">
      ${e.head({ title: d.title })}
      <body>
        <div page>
          <header>
            <h1>${d.title}</h1>
          </header>
          <main id="main-content">
            ${t.unsafe(`<div grid>${d.page}</page>`)}
          </main>
        </div>
      </body>
    </html>`;
};
