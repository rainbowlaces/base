import { redactor } from "../decorators/logRedactor.js";
import { PatternRedactor } from "./patternRedactor.js";

@redactor()
export class PhoneNumberRedactor extends PatternRedactor {
    readonly priority = 15;
    protected readonly patternName = "phone_number";
    protected readonly defaultPattern = /(((\+|00)(?:[ .-])?\d{1,3}[ .-]?\(?\d?\)?[ .-]?)|\(?0\)?)([ .-]?\d{2,8}){3,5}/;
}
