import { redactor } from "../decorators/logRedactor.js";
import { PatternRedactor } from "./patternRedactor.js";

@redactor()
export class ZipCodeRedactor extends PatternRedactor {
    readonly priority = 50;
    protected readonly patternName = "zip_code";
    protected readonly defaultPattern = /\b\d{5}(-\d{4})?\b/;
}
