import { type BaseDiWrapper, type Constructor, type Instance, type Scalar, type DiTeardown } from "./types.js";
import { BaseInitializer } from "./baseInitializer.js";
import { debugLog } from "../../utils/debugLog.js";
import { delay } from "../../utils/async.js";
import { BaseError } from "../baseErrors.js";

export { BaseAutoload } from "./baseAutoload.js";
export { BaseInitializer } from "./baseInitializer.js";

export { di } from "./decorators/di.js";
export { diByTag } from "./decorators/diByTag.js";

export * from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BaseDi {
  private static registrations = new Map<string, BaseDiWrapper<unknown>>();
  private static instances = new Map<string, unknown>();
  private static resolving = new Set<string>();

  static register<T>(
    value: Constructor<T> | Instance<T> | Scalar,
    wrapper: string | Partial<BaseDiWrapper<T>> = {},
  ): void {
    debugLog(`[BaseDi] Starting registration process for value:`, value);
    debugLog(`[BaseDi] Initial wrapper parameter:`, wrapper);
    
    if (typeof wrapper === "string") {
      debugLog(`[BaseDi] Converting string wrapper '${wrapper}' to object`);
      wrapper = { key: wrapper };
    }

    if (BaseDi.isConstructor(value)) {
      debugLog(`[BaseDi] Detected constructor type: ${(value as Constructor<T>).name}`);
      wrapper = {
        singleton: false,
        key: (value as Constructor<T>).name,
        ...wrapper,
        type: "constructor",
        value,
      };
      debugLog(`[BaseDi] Constructor wrapper prepared:`, wrapper);
    } else if (BaseDi.isInstance(value)) {
      debugLog(`[BaseDi] Detected instance type: ${(value as object).constructor.name}`);
      wrapper = {
        key: (value as object).constructor.name,
        ...wrapper,
        singleton: true,
        type: "instance",
        value,
      };
      debugLog(`[BaseDi] Instance wrapper prepared:`, wrapper);
      debugLog(`[BaseDi] Caching instance immediately for key: ${wrapper.key}`);
      BaseDi.instances.set(wrapper.key as string, value);
    } else if (BaseDi.isScalar(value)) {
      debugLog(`[BaseDi] Detected scalar type:`, typeof value, value);
      wrapper = {
        ...wrapper,
        singleton: true,
        type: "scalar",
        value,
      };
      if (!wrapper.key) {
        debugLog(`[BaseDi] ❌ Scalar value missing required key`);
        throw new BaseError("Key is required for scalar values");
      }
      debugLog(`[BaseDi] Scalar wrapper prepared:`, wrapper);
      debugLog(`[BaseDi] Caching scalar immediately for key: ${wrapper.key}`);
      BaseDi.instances.set(wrapper.key, value);
    } else {
      debugLog(`[BaseDi] ❌ Invalid value type for DI registration:`, typeof value, value);
      throw new BaseError("Invalid value type for DI registration");
    }
    
    debugLog(`[BaseDi] ✅ Registered ${wrapper.type} '${wrapper.key}' (singleton: ${wrapper.singleton})`);
    BaseDi.registrations.set(wrapper.key as string, wrapper as BaseDiWrapper<unknown>);
    debugLog(`[BaseDi] Total registrations: ${BaseDi.registrations.size}, Total cached instances: ${BaseDi.instances.size}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static resolve<T>(key: string | Constructor<T>, ...args: any[]): T {
    const keyStr = typeof key === "string" ? key : key.name;
    debugLog(`[BaseDi] Starting resolution for key: ${keyStr}`);
    debugLog(`[BaseDi] Arguments provided:`, args);
    
    if (!key) {
      debugLog(`[BaseDi] ❌ Empty key provided for resolution`);
      throw new BaseError("Cannot resolve DI with an empty key.");
    }

    // Check for circular dependencies.
    if (BaseDi.resolving.has(keyStr)) {
      const path = Array.from(BaseDi.resolving).join(' -> ');
      debugLog(`[BaseDi] ❌ Circular dependency detected: ${path} -> ${keyStr}`);
      throw new BaseError(`Circular dependency detected: ${path} -> ${keyStr}`);
    }

    // Check if already cached
    if (BaseDi.instances.has(keyStr)) {
      debugLog(`[BaseDi] ✅ Found cached instance for key: ${keyStr}`);
      return BaseDi.instances.get(keyStr) as T;
    }

    debugLog(`[BaseDi] No cached instance found, adding ${keyStr} to resolving set`);
    BaseDi.resolving.add(keyStr);
    debugLog(`[BaseDi] Currently resolving:`, Array.from(BaseDi.resolving));

    try {
      const wrapper = BaseDi.registrations.get(keyStr) as BaseDiWrapper<T> | undefined;
      if (!wrapper) {
        debugLog(`[BaseDi] ❌ No registration found for key: ${keyStr}`);
        debugLog(`[BaseDi] Available registrations:`, Array.from(BaseDi.registrations.keys()));
        throw new BaseError(`Dependency Injection Error: No registration found for key '${keyStr}'. Make sure the service is registered.`);
      }
      
      debugLog(`[BaseDi] Found registration for ${keyStr}:`, wrapper);
      
      if (wrapper.type !== "constructor") {
        debugLog(`[BaseDi] ❌ Cannot resolve non-constructor type '${wrapper.type}' that was not already cached`);
        throw new BaseError(`Cannot resolve non-constructor type '${wrapper.type}' that was not already cached.`);
      }

      debugLog(`[BaseDi] Instantiating constructor for ${keyStr} with args:`, args);
       
      const instance = new (wrapper.value as Constructor<T>)(...args);
      debugLog(`[BaseDi] ✅ Successfully instantiated ${keyStr}`);

      if (wrapper.singleton) {
        debugLog(`[BaseDi] Caching singleton instance for ${keyStr}`);
        BaseDi.instances.set(keyStr, instance);
        debugLog(`[BaseDi] Total cached instances: ${BaseDi.instances.size}`);
      } else {
        debugLog(`[BaseDi] Not caching non-singleton instance for ${keyStr}`);
      }

      return instance;
    } finally {
      debugLog(`[BaseDi] Removing ${keyStr} from resolving set`);
      BaseDi.resolving.delete(keyStr);
    }
  }
  
  static resolveByTag<T>(tag: string): T[] {
    debugLog(`[BaseDi] Starting resolution by tag: ${tag}`);
    const resolvedInstances: T[] = [];
    const matchingServices: string[] = [];
    
    for (const wrapper of BaseDi.registrations.values()) {
      if (wrapper.tags?.has(tag) && wrapper.key) {
        debugLog(`[BaseDi] Found service '${wrapper.key}' with tag '${tag}'`);
        matchingServices.push(wrapper.key);
        resolvedInstances.push(BaseDi.resolve<T>(wrapper.key));
      }
    }
    
    debugLog(`[BaseDi] ✅ Resolved ${resolvedInstances.length} instances for tag '${tag}':`, matchingServices);
    return resolvedInstances;
  }

  static async teardown(): Promise<void> {
    debugLog(`[BaseDi] Starting teardown process`);
    debugLog(`[BaseDi] Total registrations: ${BaseDi.registrations.size}, Total instances: ${BaseDi.instances.size}`);
    
    const phases = new Map<number, string[]>();
    
    for (const registration of BaseDi.registrations.values()) {
        if (!registration.key) {
          debugLog(`[BaseDi] Skipping registration without key:`, registration);
          continue;
        }
        const phase = registration.phase ?? 100;
        debugLog(`[BaseDi] Processing registration '${registration.key}' for phase ${phase}`);
        if (!phases.has(phase)) {
            debugLog(`[BaseDi] Creating new teardown phase: ${phase}`);
            phases.set(phase, []);
        }
        phases.get(phase)!.push(registration.key);
    }
    
    debugLog(`[BaseDi] Total teardown phases: ${phases.size}`);
    phases.forEach((items, phase) => {
      debugLog(`[BaseDi] Phase ${phase}: ${items.length} services (${items.join(', ')})`);
    });
    
    const sortedPhaseNumbers = Array.from(phases.keys()).sort((a, b) => b - a);
    debugLog(`[BaseDi] Teardown execution order (reverse):`, sortedPhaseNumbers);

    for (const phaseNumber of sortedPhaseNumbers) {
      const itemsInPhase = phases.get(phaseNumber)!;
      debugLog(`[BaseDi] === Starting teardown phase ${phaseNumber} with ${itemsInPhase.length} services ===`);
      
      const phasePromises = itemsInPhase.map(async (name) => {
        if (BaseDi.instances.has(name)) {
          const instance = BaseDi.instances.get(name);
          if (instance && typeof (instance as DiTeardown).teardown === 'function') {
            debugLog(`[BaseDi] Calling teardown for service: ${name}`);
            try {
              await (instance as DiTeardown).teardown();
              debugLog(`[BaseDi] ✅ Teardown completed for: ${name}`);
            } catch (error) {
              console.error(`[BaseDi] ❌ Teardown failed for ${name}:`, error);
              debugLog(`[BaseDi] Continuing with other teardowns despite failure`);
            }
          } else {
            debugLog(`[BaseDi] Service '${name}' does not have teardown method, using delay() as no-op`);
            await delay();
            debugLog(`[BaseDi] ✅ No-op teardown completed for: ${name}`);
          }
        } else {
          debugLog(`[BaseDi] Service '${name}' not in instances cache, skipping teardown`);
        }
      });
      
      debugLog(`[BaseDi] Waiting for teardown phase ${phaseNumber} to complete...`);
      await Promise.all(phasePromises);
      debugLog(`[BaseDi] ✅ Teardown phase ${phaseNumber} completed`);
    }

    debugLog(`[BaseDi] All teardown phases completed, calling reset()`);
    BaseDi.reset();
  }

  public static reset(): void {
    debugLog(`[BaseDi] Starting reset process`);
    debugLog(`[BaseDi] Clearing ${BaseDi.instances.size} instances`);
    BaseDi.instances.clear();
    debugLog(`[BaseDi] Clearing ${BaseDi.registrations.size} registrations`);
    BaseDi.registrations.clear();
    debugLog(`[BaseDi] Clearing BaseInitializer`);
    BaseInitializer.clear();
    debugLog(`[BaseDi] Clearing ${BaseDi.resolving.size} resolving entries`);
    BaseDi.resolving.clear();
    debugLog(`[BaseDi] ✅ Reset completed - all DI state cleared`);
  }

  static getRegistration(key: string): BaseDiWrapper<unknown> | undefined {
    debugLog(`[BaseDi] Getting registration for key: ${key}`);
    const registration = BaseDi.registrations.get(key);
    if (registration) {
      debugLog(`[BaseDi] ✅ Found registration for '${key}':`, registration);
    } else {
      debugLog(`[BaseDi] ❌ No registration found for '${key}'`);
      debugLog(`[BaseDi] Available registrations:`, Array.from(BaseDi.registrations.keys()));
    }
    return registration;
  }

  private static isInstance(value: unknown): value is Instance<never> {
    return typeof value === "object" && value !== null;
  }

  private static isConstructor(value: unknown): value is Constructor<never> {
    return typeof value === "function" && !!value.prototype;
  }

  private static isScalar(value: unknown): value is Scalar {
    return typeof value === "number" || 
           typeof value === "string" || 
           typeof value === "boolean" || 
           typeof value === "bigint" || 
           typeof value === "symbol" ||
           value === null ||
           value === undefined;
  }
}