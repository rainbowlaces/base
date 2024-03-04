import { expect } from "chai";
import DependencyManager from "../../dependencyManager";

// Assuming these classes are designed to be compatible with the DependencyManager
class A {
  static dependsOn = [];
}

class B {
  static dependsOn = ["A"];
}

class C {
  static dependsOn = ["B"];
}

class D {
  static dependsOn = ["E"];
}

class E {
  static dependsOn = ["D"];
}

describe("DependencyManager", () => {
  it("should add a node without dependencies", () => {
    const dm = new DependencyManager();
    dm.addNode(A);
    expect([...dm]).to.have.lengthOf(1);
  });

  it("should order nodes based on dependencies", () => {
    expect(
      [...new DependencyManager([B, C, A])].map((node) => node.name),
    ).to.deep.equal(["A", "B", "C"]);
  });

  it("should throw an error for missing dependencies", () => {
    expect(() =>
      [...new DependencyManager([A, D])].map((node) => node.name),
    ).to.throw(Error, "Node D depends on node(s) E, but they don't exist!");
  });

  it("should detect cycles and throw an error", () => {
    expect(() =>
      [...new DependencyManager([D, E])].map((node) => node.name),
    ).to.throw(Error, "Cycles detected. Sort it out!");
  });

  it("should handle adding a node after initial sorting", () => {
    const dm = new DependencyManager([A, B]);
    expect([...dm].map((node) => node.name)).to.deep.equal(["A", "B"]);
    dm.addNode(C);
    expect([...dm].map((node) => node.name)).to.deep.equal(["A", "B", "C"]);
  });

  it("should toString correctly", () => {
    const dm = new DependencyManager();
    expect(dm.toString()).to.equal("");
    dm.addNodes([A, B, C]);
    expect(dm.toString()).to.equal("A --> B\nB --> C\nC --> ");
  });
});
