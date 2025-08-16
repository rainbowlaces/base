import { logSerializer } from "../decorators/logSerializer.js";
import { type LogObjectTransformer } from "../types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor = new (...args: any[]) => any;

/**
 * A serializer plugin for class constructors.
 * It transforms a constructor function into its string name.
 */
@logSerializer()
export class ConstructorSerializer implements LogObjectTransformer {
  readonly priority: number = 90;
  
  /**
   * Checks if the value is a function (likely a constructor).
   */
  public canTransform(value: unknown): value is Constructor {
    return typeof value === "function";
  }

  /**
   * Returns the name of the constructor.
   */
  public transform(value: Constructor): unknown {
    return `[Constructor: ${value.name}]`;
  }
}