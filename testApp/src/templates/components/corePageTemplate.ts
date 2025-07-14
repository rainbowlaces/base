import { template, BaseTemplate, type TemplateResult, html } from "../../../../src/index.js";

export interface CorePageTemplateData {
  title: string;
  headerData: {
    title: string;
    currentPage?: string;
  };
  content: TemplateResult;
  footerData?: {
    text?: string;
  };
}

@template()
export class CorePageTemplate extends BaseTemplate<CorePageTemplateData> {
  public render(): TemplateResult {
    return html`
<!DOCTYPE html>
<html>
<head>
    <title>${this.data.title}</title>
    <link rel="stylesheet" href="/static/main.css">
    <script src="/static/bundle.js"></script>
</head>
<body>
    <div class="container-small">
        ${this.templates.HeaderTemplate(this.data.headerData)}
        
        <div class="content">
            ${this.data.content}
        </div>
        
        ${this.templates.FooterTemplate(this.data.footerData ?? {})}
    </div>
</body>
</html>
`;
  }
}

declare module "../../../../src/index.js" {
  interface Templates {
    CorePageTemplate: CorePageTemplate;
  }
}
