export type Class<T> = new (...args: unknown[]) => T;

export interface Dependable {
  name: string;
  dependsOn?: string[];
}
