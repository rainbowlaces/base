import {
  html,
  TemplateData,
  LoadedTags,
  LoadedElements,
} from "../../../../../index";

export default (d: TemplateData, t: LoadedTags, e: LoadedElements) => html`
  ${e.header({ title: d.name })} ${t.if(d.show)}
  <h1>I'M VISIBLE!</h1>
  ${t.end()} ${t.if(!d.hideThings)}
  <h2>I'M HIDDEN!</h2>
  ${t.end()} ${e.header({ title: "" })}
  ${t.each(d.items, (item: string) => html`${e.header({ title: item })}`)}
`;
