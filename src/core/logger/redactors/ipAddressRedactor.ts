import { redactor } from "../decorators/logRedactor.js";
import { PatternRedactor } from "./patternRedactor.js";

@redactor()
export class IpAddressRedactor extends PatternRedactor {
    readonly priority = 20;
    protected readonly patternName = "ip_address";
    // This combines IPv4 and IPv6 for efficiency
    protected readonly defaultPattern = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})|(([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}))/;
}
