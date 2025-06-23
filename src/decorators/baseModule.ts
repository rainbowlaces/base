import { BaseModule } from "../core/baseModule";

// Registry to store module classes decorated with @baseModule
const moduleRegistry = new Set<new () => BaseModule>();

/**
 * Decorator to automatically register modules with the Base framework.
 * Classes decorated with @baseModule will be automatically instantiated and registered
 * during Base.init() without needing manual addModule() calls.
 */
export function baseModule<T extends new () => BaseModule>(target: T): T {
  moduleRegistry.add(target as new () => BaseModule);
  return target;
}

/**
 * Get all registered module classes
 */
export function getRegisteredModules(): Set<new () => BaseModule> {
  return new Set(moduleRegistry);
}

/**
 * Clear the module registry (mainly for testing)
 */
export function clearModuleRegistry(): void {
  moduleRegistry.clear();
}
