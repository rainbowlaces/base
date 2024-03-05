import { TypeSerializer, LogContext } from "../types";
import { ErrorSerializer } from "./errorSerializer";
import { ScalarSerializer } from "./scalarSerializer";
import { recursiveMap } from "../../utils/recursion";

type ContextTransformerOptions = {
  maxItems?: number;
  maxDepth?: number;
  maxLength?: number;
};

export class ContextTransformer {
  private serializers: TypeSerializer<unknown>[] = [];

  private maxItems: number = 100;
  private maxDepth: number = 10;
  private maxLength: number = 1024;

  constructor(config?: ContextTransformerOptions) {
    this.maxItems = config?.maxItems ?? this.maxItems;
    this.maxDepth = config?.maxDepth ?? this.maxDepth;
    this.maxLength = config?.maxLength ?? this.maxLength;

    this.serializers.push(new ErrorSerializer());
    this.serializers.push(new ScalarSerializer({ maxLength: this.maxLength }));
  }

  transform(input: LogContext): unknown {
    if (!Object.keys(input).length) return {};
    return recursiveMap(
      input,
      this.transformValue.bind(this),
      {
        maxDepth: this.maxDepth,
        maxItems: this.maxItems,
      },
      0,
      new WeakMap(),
    );
  }

  private transformValue(value: unknown): unknown {
    const serializer = this.findSerializerFor(value);
    return serializer && serializer.serialize(value);
  }

  private findSerializerFor(input: unknown): TypeSerializer<unknown> | null {
    return (
      this.serializers.find((serializer) => serializer.canSerialize(input)) ||
      null
    );
  }
}
