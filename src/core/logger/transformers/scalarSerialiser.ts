import { BaseDi } from "../../di/baseDi";
import { LoggerConfig, LogObjectTransformer } from "../types";
import { logSerializer } from "../decorators/logSerializer";

export interface ScalarSerializerConfig {
  maxLength: number;
}

declare module "../types" {
  interface LoggerConfig {
    scalarSerializer?: ScalarSerializerConfig;
  }
}

/**
 * A serializer plugin for primitive scalar values.
 * It truncates long strings based on its configuration.
 */
@logSerializer() // Lowest priority, acts as a catch-all for primitives.
export class ScalarSerializer implements LogObjectTransformer {
    readonly priority: number = 100;
  
    private readonly config: ScalarSerializerConfig;

  constructor() {
    const fullLoggerConfig = BaseDi.resolve<LoggerConfig>('Config.BaseLogger');
    this.config = fullLoggerConfig.scalarSerializer ?? { maxLength: 1024 };
  }  

  public canTransform(value: unknown): value is string | number | boolean | null | undefined {
    const type = typeof value;
    return (
      type === "string" ||
      type === "number" ||
      type === "boolean" ||
      type === "undefined" ||
      value === null
    );
  }

  /**
   * Transforms the scalar value. If it's a long string, it truncates it.
   */
  public transform(value: string | number | boolean | null | undefined): unknown {
    if (typeof value === "string" && value.length > this.config.maxLength) {
      const truncationMarker = "...[TRUNCATED]";
      return `${value.substring(0, this.config.maxLength - truncationMarker.length)}${truncationMarker}`;
    }
    return value;
  }
}