import { TypeSerializer } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor = new (...args: any[]) => any;

export class ConstructorSerializer implements TypeSerializer<Constructor> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canSerialize(input: any): input is Constructor {
    return typeof input === "function";
  }

  serialize(input: Constructor): string {
    return input.name;
  }
}
