import { Dependable } from "./types";

/**
 * Represents a node in the dependency graph, encapsulating a value and its dependencies.
 */
export default class Node {
  name: string;
  dependsOn: string[] = [];
  value: unknown;

  constructor(value: Dependable) {
    if (value.dependsOn && !Array.isArray(value.dependsOn))
      throw new Error("dependsOn must be an array");
    if (!value.name) throw new Error("name is required");

    this.dependsOn = value.dependsOn ?? [];
    this.name = value.name;
    this.value = value;
  }
}
