import { redactor } from "../decorators/logRedactor.js";
import { PatternRedactor } from "./patternRedactor.js";

@redactor()
export class EmailRedactor extends PatternRedactor {
  readonly priority = 10;
  protected readonly patternName = "email";
  protected readonly defaultPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/;
}
