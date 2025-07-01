class BaseTemplate {

}

class TemplateResult {
    constructor() {
        
    }
}

function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): TemplateResult {
  return new TemplateResult(Array.from(strings), values);
}

export { html, BaseTemplate, TemplateResult };