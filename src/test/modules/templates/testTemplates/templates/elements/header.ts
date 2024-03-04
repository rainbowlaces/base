import { html, TemplateData, LoadedTags } from "../../../../../../index";

export default (d: TemplateData, t: LoadedTags) =>
  html`${t.if(!!d.title)}
    <h1>${d.title}</h1>
    ${t.end()}`;
