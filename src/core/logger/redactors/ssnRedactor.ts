import { redactor } from "../decorators/logRedactor";
import { PatternRedactor } from "./patternRedactor";

@redactor()
export class SsnRedactor extends PatternRedactor {
    readonly priority = 5;
    protected readonly patternName = "ssn";
    protected readonly defaultPattern = /(?!000|666|9\d{2})(\d{3})((-| )?)(?!00)\d{2}\2(?!0000)\d{4}/;
}
