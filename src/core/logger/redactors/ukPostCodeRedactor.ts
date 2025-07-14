import { redactor } from "../decorators/logRedactor.js";
import { PatternRedactor } from "./patternRedactor.js";

@redactor()
export class UkPostCodeRedactor extends PatternRedactor {
    readonly priority = 30;
    protected readonly patternName = "uk_post_code";
    protected readonly defaultPattern = /(([A-Z]{1,2}\d{1,2}[A-Z]?|GIR)\s?\d{1}[A-Z]{2})|BFPO\s?\d{1,3}/;
}
