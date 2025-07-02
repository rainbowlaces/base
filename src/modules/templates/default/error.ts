import { BaseTemplate } from "../baseTemplate";
import { template } from "../decorators/template";
import { html } from "../engine/html";
import { type TemplateResult } from "../engine/templateResult";

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

declare module "../types" {
    interface Templates {
        ErrorTemplate: (data: Error) => TemplateResult;
    }
}