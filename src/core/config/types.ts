// ConfigObject allows any type of value for flexibility in configuration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ConfigObject = Record<string, any>;

// Helper type for unknown config values that need to be type-asserted
export type UnknownConfigValue = unknown;
