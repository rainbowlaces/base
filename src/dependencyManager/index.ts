import graphlib from "graphlib";
import Node from "./node";
import { Class, Dependable } from "./types";

/**
 * Manages dependencies between different parts of the application, ensuring that modules or components
 * are initialized in the correct order based on their dependencies. Supports topological sorting to resolve
 * dependency order and cycle detection to prevent infinite loops.
 */
export default class DependencyManager<T> implements Iterable<T> {
  private _nodes: Record<string, Node> = {};
  private _graph: graphlib.Graph = new graphlib.Graph();
  private _sortedNodes: Array<T>;

  /**
   * Initializes a new instance of DependencyManager, optionally with an initial set of nodes.
   * @param {Array<T>} [nodes] - Optional initial nodes to add to the manager.
   */
  constructor(nodes?: Array<T>) {
    this._sortedNodes = [];
    if (nodes) this.addNodes(nodes);
  }

  /**
   * Adds a node to the dependency graph. If the node has dependencies, they must already be added.
   * @param {T | Class<T>} node - The node to add, which can be an instance or a class.
   */
  addNode(node: T): void;
  addNode<U extends T>(node: Class<U>): void;
  addNode<U extends T>(node: Class<U> | T) {
    this._sortedNodes = [];

    const boxedNode: Node = new Node(node as Dependable);

    if (boxedNode.name.startsWith("bound "))
      boxedNode.name = boxedNode.name.slice(6);

    this._nodes[boxedNode.name] = boxedNode;
    this._graph.setNode(boxedNode.name);

    (boxedNode.dependsOn || []).forEach((dependency) => {
      this._graph.setEdge(dependency, boxedNode.name);
    });
  }

  /**
   * Adds multiple nodes to the dependency graph.
   * @param {Array<T>} nodes - An array of nodes to add.
   */
  addNodes(nodes: Array<T>) {
    nodes.forEach((node) => this.addNode(node));
  }

  /**
   * Provides an iterator over the nodes in dependency order.
   * @returns {Iterator<T>} An iterator that yields nodes in dependency order.
   */
  [Symbol.iterator](): Iterator<T> {
    let index = 0;
    const sortedNodes = this._sort();

    return {
      next: () => {
        if (index < sortedNodes.length) {
          return { value: sortedNodes[index++], done: false };
        } else {
          return { done: true, value: null };
        }
      },
    };
  }

  /**
   * Returns a string representation of the dependency graph, useful for debugging.
   * @returns {string} A string representation of the graph.
   */
  toString() {
    const output = this._graph.nodes().map((node) => {
      const edgesArray = this._graph.outEdges(node);
      const edges = Array.isArray(edgesArray)
        ? edgesArray.map((edge: { w: string }) => edge.w).join(", ")
        : "";
      return `${node} --> ${edges}`;
    });
    return output.join("\n");
  }

  private _sort() {
    if (this._sortedNodes.length) return this._sortedNodes;

    // Cycle Detection
    if (graphlib.alg.isAcyclic(this._graph) === false) {
      throw new Error("Cycles detected. Sort it out!");
    }

    // Check dependencies all exist
    const error = (Object.values(this._nodes) as Node[])
      .map((node) => {
        const badDeps = (node.dependsOn || []).filter(
          (dep) => !this._nodes[dep],
        );
        return { name: node.name, badDeps };
      })
      .filter(({ badDeps }) => badDeps.length)
      .map(
        ({ name, badDeps }) =>
          `Node ${name} depends on node(s) ${badDeps.join(", ")}, but they don't exist!`,
      )
      .join("\n");

    if (error) throw new Error(error);

    // Topological Sort
    const sortedNodeNames = graphlib.alg.topsort(this._graph);
    this._sortedNodes = sortedNodeNames.map((name) => {
      return this._nodes[name].value as T;
    });

    return this._sortedNodes;
  }
}
