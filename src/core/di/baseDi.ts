import { type BaseDiWrapper, type Constructor, type Instance, type Scalar, type DiTeardown } from "./types";
import { BaseInitializer } from "./baseInitializer";

export { BaseAutoload } from "./baseAutoload";
export { BaseInitializer } from "./baseInitializer";

export { di } from "./decorators/di";
export { diByTag } from "./decorators/diByTag";

export * from "./types";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BaseDi {
  private static registrations = new Map<string, BaseDiWrapper<unknown>>();
  private static instances = new Map<string, unknown>();
  private static resolving = new Set<string>();

  static register<T>(
    value: Constructor<T> | Instance<T> | Scalar,
    wrapper: string | Partial<BaseDiWrapper<T>> = {},
  ): void {
    if (typeof wrapper === "string") {
      wrapper = { key: wrapper };
    }

    if (BaseDi.isConstructor(value)) {
      wrapper = {
        singleton: false,
        key: (value as Constructor<T>).name,
        ...wrapper,
        type: "constructor",
        value,
      };
    } else if (BaseDi.isInstance(value)) {
      wrapper = {
        key: (value as object).constructor.name,
        ...wrapper,
        singleton: true,
        type: "instance",
        value,
      };
      BaseDi.instances.set(wrapper.key as string, value);
    } else if (BaseDi.isScalar(value)) {
      wrapper = {
        ...wrapper,
        singleton: true,
        type: "scalar",
        value,
      };
      if (!wrapper.key) throw new Error("Key is required for scalar values");
      BaseDi.instances.set(wrapper.key, value);
    } else {
      throw new Error("Invalid value type for DI registration");
    }
    
    console.log(`DI: Registered ${wrapper.type} '${wrapper.key}' (singleton: ${wrapper.singleton})`);
    BaseDi.registrations.set(wrapper.key as string, wrapper as BaseDiWrapper<unknown>);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static resolve<T>(key: string | Constructor<T>, ...args: any[]): T {
    const keyStr = typeof key === "string" ? key : key.name;

    // Check for circular dependencies.
    if (BaseDi.resolving.has(keyStr)) {
      const path = Array.from(BaseDi.resolving).join(' -> ');
      throw new Error(`Circular dependency detected: ${path} -> ${keyStr}`);
    }

    if (BaseDi.instances.has(keyStr)) {
      return BaseDi.instances.get(keyStr) as T;
    }

    BaseDi.resolving.add(keyStr);

    try {
      const wrapper = BaseDi.registrations.get(keyStr) as BaseDiWrapper<T> | undefined;
      if (!wrapper) {
        throw new Error(`Dependency Injection Error: No registration found for key '${keyStr}'. Make sure the service is registered.`);
      }
      
      if (wrapper.type !== "constructor") {
          throw new Error(`Cannot resolve non-constructor type '${wrapper.type}' that was not already cached.`);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const instance = new (wrapper.value as Constructor<T>)(...args);

      if (wrapper.singleton) {
        BaseDi.instances.set(keyStr, instance);
      }

      return instance;
    } finally {
      BaseDi.resolving.delete(keyStr);
    }
  }
  
  static resolveByTag<T>(tag: string): T[] {
    const resolvedInstances: T[] = [];
    for (const wrapper of BaseDi.registrations.values()) {
      if (wrapper.tags?.has(tag) && wrapper.key) {
        resolvedInstances.push(BaseDi.resolve<T>(wrapper.key));
      }
    }
    return resolvedInstances;
  }

  static async teardown(): Promise<void> {    
    const phases = new Map<number, string[]>();
    
    for (const registration of BaseDi.registrations.values()) {
        if (!registration.key) continue; // Skip registrations without keys
        const phase = registration.phase ?? 100;
        if (!phases.has(phase)) {
            phases.set(phase, []);
        }
        phases.get(phase)!.push(registration.key);
    }
    
    const sortedPhaseNumbers = Array.from(phases.keys()).sort((a, b) => b - a);

    for (const phaseNumber of sortedPhaseNumbers) {
      const itemsInPhase = phases.get(phaseNumber)!;
      const phasePromises = itemsInPhase.map(async (name) => {
        if (BaseDi.instances.has(name)) {
          const instance = BaseDi.instances.get(name);
          if (instance && typeof (instance as DiTeardown).teardown === 'function') {
            try {
              await (instance as DiTeardown).teardown();
            } catch {
              // Continue with other teardowns despite this failure
            }
          }
        }
      });
      await Promise.all(phasePromises);
    }

    BaseDi.reset();
  }

  public static reset(): void {
    BaseDi.instances.clear();
    BaseDi.registrations.clear();
    BaseInitializer.clear();
    BaseDi.resolving.clear();
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