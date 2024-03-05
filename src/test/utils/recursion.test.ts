import { expect } from "chai";
import { recursiveMap } from "../../utils/recursion";

const context = {
  a: 1,
  b: 2,
  c: {
    d: 3,
    e: 4,
    f: [5, 6, 7],
  },
  g: [8, 9, 10],
  h: 11,
  i: {
    j: 12,
    k: 13,
    l: [14, 15, 16],
  },
};

describe("recursiveMap", () => {
  it("recurses and returns defaults", () => {
    const result = recursiveMap(context);
    expect(result).to.deep.equal({ ...context });
  });
  it("respects maxItems", () => {
    const result = recursiveMap(context, { maxItems: 3 });
    expect(result).to.deep.equal({
      a: 1,
      b: 2,
      c: { d: 3, e: 4, f: [5, 6, 7] },
    });
  });
  it("respects maxDepth", () => {
    const result = recursiveMap(context, { maxDepth: 2 });
    expect(result).to.deep.equal({
      a: 1,
      b: 2,
      c: { d: {}, e: {}, f: {} },
      g: [{}, {}, {}],
      h: 11,
      i: { j: {}, k: {}, l: {} },
    });
  });
  it("transforms values", () => {
    const getTransformer = (value: unknown) => {
      if (typeof value === "number") {
        return () => value * 2;
      }
      return null;
    };
    const result = recursiveMap(context, {}, getTransformer);
    expect(result).to.deep.equal({
      a: 2,
      b: 4,
      c: {
        d: 6,
        e: 8,
        f: [10, 12, 14],
      },
      g: [16, 18, 20],
      h: 22,
      i: {
        j: 24,
        k: 26,
        l: [28, 30, 32],
      },
    });
  });
});
