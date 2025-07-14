import { BaseTemplate } from "../baseTemplate.js";
import { template } from "../decorators/template.js";
import { html } from "../engine/html.js";
import { type TemplateResult } from "../engine/templateResult.js";

@template()
export class ErrorTemplate extends BaseTemplate<Error> {
    public render(): TemplateResult {
        return html`
            <div class="error">
                <h1>Error</h1>
                <p>${this.data.message}</p>
            </div>
        `;
    }
}

declare module "../types.js" {
    interface Templates {
        ErrorTemplate: ErrorTemplate;
    }
}