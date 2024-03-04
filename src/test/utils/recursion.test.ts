import { expect } from "chai";
import { recursiveMap } from "../../utils/recursion";

describe("recursiveMap", () => {
  it("transforms simple objects", () => {
    const input = { a: 1, b: 2 };
    const result = recursiveMap(input, (value) => (value as number) * 2);
    expect(result).to.deep.equal({ a: 2, b: 4 });
  });

  it("transforms arrays", () => {
    const input = [1, 2, 3];
    const result = recursiveMap(input, (value) => (value as number) + 1);
    expect(result).to.deep.equal([2, 3, 4]);
  });

  it("respects maxDepth option", () => {
    const input = { a: { b: { c: 1 } } };
    const result = recursiveMap(input, (value) => value, { maxDepth: 2 });
    expect(result).to.deep.equal({ a: { b: {} } });
  });

  it("respects maxItems option", () => {
    const input = [1, 2, 3, 4, 5];
    const result = recursiveMap(input, (value) => value, { maxItems: 3 });
    expect(result).to.deep.equal([1, 2, 3]);
  });

  it("handles circular references", () => {
    const input: any = { a: null };
    input.a = input;
    const result = recursiveMap(input, (value) => value);
    expect(result).to.deep.equal({ a: result });
  });

  it("applies transformation function correctly", () => {
    const input = { a: 1, b: { c: 2, d: 3 } };
    const transform = (value: unknown) =>
      typeof value === "number" ? value * 2 : value;
    const result = recursiveMap(input, transform);
    expect(result).to.deep.equal({ a: 2, b: { c: 4, d: 6 } });
  });
});
