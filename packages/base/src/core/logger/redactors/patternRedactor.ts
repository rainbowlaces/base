import { config } from "../../config/decorators/config.js";
import { BaseLogger, type LoggerConfig } from "../baseLogger.js";
import { type LogObjectTransformer } from "../types.js";

/**
 * An abstract base class for redactor plugins that operate on simple string patterns.
 * It handles the logic for fetching patterns from the configuration, leaving
 * subclasses to define only the specific pattern they target.
 */
export abstract class PatternRedactor implements LogObjectTransformer {
  public abstract readonly priority: number;
  protected abstract readonly patternName: string;
  protected abstract readonly defaultPattern: RegExp;
  #pattern: RegExp | undefined;

  @config(BaseLogger)
  private accessor config!: LoggerConfig

  private get pattern(): RegExp {
    if (!this.#pattern) {
      const configuredPattern = this.config.patterns[this.patternName];
      
      this.#pattern = new RegExp(
        configuredPattern || this.defaultPattern,
        'gui'
      );
    }
    return this.#pattern;
  }

  public canTransform(value: unknown): value is string {
    return typeof value === "string";
  }

  public transform(value: string): string {
    // The `pattern` getter is called here, ensuring the RegExp is initialized.
    return value.replace(this.pattern, `[REDACTED:${this.patternName.toUpperCase()}]`);
  }
}
