import { redactor } from "../decorators/logRedactor.js";
import { PatternRedactor } from "./patternRedactor.js";

@redactor()
export class NiNumberRedactor extends PatternRedactor {
    readonly priority = 30;
    protected readonly patternName = "ni_number";
    protected readonly defaultPattern = /[A-Z]{2}([ -]?)(\d{2}\1?){3}[A-Z]/;
}
