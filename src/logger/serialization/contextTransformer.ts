import { TypeSerializer, LogContext } from "../types";
import { ErrorSerializer } from "./errorSerializer";
import { ScalarSerializer } from "./scalarSerializer";
import { TransformFunction, recursiveMap } from "../../utils/recursion";
import { ConstructorSerializer } from "./constructorSerializer";

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
    this.serializers.push(new ConstructorSerializer());
  }

  transform(input: LogContext): unknown {
    if (!Object.keys(input).length) return {};
    return recursiveMap(
      input,
      {
        maxDepth: this.maxDepth,
        maxItems: this.maxItems,
      },
      this.findSerializerFor.bind(this),
    );
  }

  private findSerializerFor(input: unknown): TransformFunction | null {
    const s = this.serializers.find((serializer) =>
      serializer.canSerialize(input),
    );
    return s ? (value) => s.serialize(value) : null;
  }
}
