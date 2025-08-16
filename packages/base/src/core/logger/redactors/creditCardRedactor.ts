import { redactor } from "../decorators/logRedactor.js";
import { PatternRedactor } from "./patternRedactor.js";

@redactor()
export class CreditCardRedactor extends PatternRedactor {
    readonly priority = 10;
    protected readonly patternName = "credit_card";
    protected readonly defaultPattern = /[3456]\d{3}([. -]?)((\d{4}\1\d{4}\1\d{4}(\1\d{1,3})?)|(\d{6}\1\d{4,5}))/;
}
