import { BaseDi } from "../../di/baseDi";
import { LoggerConfig, LogObjectTransformer } from "../types";

/**
 * An abstract base class for redactor plugins that operate on simple string patterns.
 * It handles the logic for fetching patterns from the configuration, leaving
 * subclasses to define only the specific pattern they target.
 */
export abstract class PatternRedactor implements LogObjectTransformer {
  public abstract readonly priority: number;
  protected abstract readonly patternName: string;
  protected abstract readonly defaultPattern: RegExp;
  private _pattern: RegExp | undefined;

  private get pattern(): RegExp {
    if (!this._pattern) {
      const fullLoggerConfig = BaseDi.resolve<LoggerConfig>('Config.BaseLogger');
      const configuredPattern = fullLoggerConfig.patterns?.[this.patternName];
      
      this._pattern = new RegExp(
        configuredPattern ?? this.defaultPattern,
        'gui'
      );
    }
    return this._pattern;
  }

  public canTransform(value: unknown): value is string {
    return typeof value === "string";
  }

  public transform(value: string): string {
    // The `pattern` getter is called here, ensuring the RegExp is initialized.
    return value.replace(this.pattern, `[REDACTED:${this.patternName.toUpperCase()}]`);
  }
}
