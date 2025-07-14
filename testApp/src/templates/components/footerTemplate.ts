import { template, BaseTemplate, type TemplateResult, html } from "../../../../src/index.js";

export interface FooterTemplateData {
  text?: string;
}

@template()
export class FooterTemplate extends BaseTemplate<FooterTemplateData> {
  public render(): TemplateResult {
    return html`
        <div class="footer">
            <p>${this.data.text ?? '🚀 RL-Base Framework - Component-Based Templates'}</p>
        </div>
        
        <style>
            .footer {
                background: #2c3e50;
                color: white;
                text-align: center;
                padding: 20px;
                font-size: 0.9rem;
                margin-top: auto;
            }
            .footer p {
                margin: 0;
            }
        </style>
`;
  }
}

declare module "../../../../src/index.js" {
  interface Templates {
    FooterTemplate: FooterTemplate;
  }
}
