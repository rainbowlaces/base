import { type BaseClassConfig } from "../../../core/config/types";

export interface TemplateConfig extends BaseClassConfig {
  /**
   * Maximum buffer size in megabytes before throwing E_TEMPLATE_BUFFER_EXCEEDED.
   * Default: 8MB
   */
  bufferLimitMB?: number;

  /**
   * Whether to perform HTML validation (Stage 4 of pipeline).
   * When true, strips on* attributes and neutralizes dangerous URL schemes.
   * Default: true
   */
  validateHtml?: boolean;

  /**
   * Whether to use strict mode for SerializerRegistry.
   * When true, duplicate serializer registration throws error.
   * When false, last handler wins.
   * Default: false
   */
  strictSerializers?: boolean;
}

// Declaration merging to add template config to global app config
declare module "../../../core/config/types" {
  interface BaseAppConfig {
    Template?: TemplateConfig;
  }
}

// Default configuration values
export const DEFAULT_TEMPLATE_CONFIG: Required<TemplateConfig> = {
  bufferLimitMB: 8,
  validateHtml: true,
  strictSerializers: false,
};
