/* eslint-disable @typescript-eslint/no-explicit-any */
// The global application configuration interface
// Modules will extend this using declaration merging

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BaseAppConfig {
  // Intentionally empty. Modules will add their own config here.
}

// Utility type that extracts the data structure from a class
// This is useful for creating provider configurations that match class structure
// All properties are made optional to allow partial configuration
export type ConfigData<T extends BaseClassConfig> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? never : K]?: T[K];
};

export abstract class BaseClassConfig {
  public hydrate(data?: Partial<any> | null): void {
    if (!data) return;
    for (const key in data) {
      if (!(key in this)) continue;
      const value = (data as any)[key];
      if (value === undefined) continue;
      (this as any)[key] = value;
    }
  }
}