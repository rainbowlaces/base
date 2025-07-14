import { type BaseConfigProvider, BaseConfigRegistry } from "../baseConfigRegistry.js";
import type { BaseClassConfig } from "../types.js";

// Registry for config classes
type ConfigClassConstructor = new () => BaseClassConfig;
const CONFIG_CLASS_REGISTRY = new Map<string, ConfigClassConstructor>();

// Class decorator for configuration providers
export function provider(environment?: string, priority?: number) {
  const env = environment?.toLowerCase() ?? 'default';
  const pri = priority ?? (env === 'default' ? 0 : 100);

  return function (target: new (env: string, pri: number) => BaseConfigProvider, _context: ClassDecoratorContext) {
    const provider = new target(env, pri);
    BaseConfigRegistry.register(provider);
  };
}

// Class decorator for configuration classes
export function configClass(namespace: string) {
  return function (target: ConfigClassConstructor, _context: ClassDecoratorContext) {
    CONFIG_CLASS_REGISTRY.set(namespace, target);
  };
}

// Get a registered config class by namespace
export function getConfigClass(namespace: string): ConfigClassConstructor | undefined {
  return CONFIG_CLASS_REGISTRY.get(namespace);
}

// Get all registered config classes
export function getAllConfigClasses(): Map<string, ConfigClassConstructor> {
  return new Map(CONFIG_CLASS_REGISTRY);
}

// Clear the config class registry (useful for testing)
export function clearConfigClassRegistry(): void {
  CONFIG_CLASS_REGISTRY.clear();
}
