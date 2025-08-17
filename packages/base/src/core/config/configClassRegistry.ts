import type { BaseClassConfig } from "./types.js";

export type ConfigClassConstructor = new () => BaseClassConfig;

// Central registry for Config Classes.
export class ConfigClassRegistry {
  private static readonly registry = new Map<string, ConfigClassConstructor>();

  static register(namespace: string, ctor: ConfigClassConstructor): void {
    this.registry.set(namespace, ctor);
  }

  static get(namespace: string): ConfigClassConstructor | undefined {
    return this.registry.get(namespace);
  }

  static getAll(): Map<string, ConfigClassConstructor> {
    return new Map(this.registry);
  }

  static clear(): void {
    this.registry.clear();
  }
}
