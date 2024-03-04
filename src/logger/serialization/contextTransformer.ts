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
    // Utilize recursiveMap for the transformation, directly returning unknown
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
    // Find and use the appropriate serializer for the value
    const serializer = this.findSerializerFor(value);
    return serializer.serialize(value);
  }

  private findSerializerFor(input: unknown): TypeSerializer<unknown> {
    const fallback: TypeSerializer<unknown> = {
      serialize: (input: unknown) => input,
      canSerialize: (input: unknown): input is unknown => true,
    };

    return (
      this.serializers.find((serializer) => serializer.canSerialize(input)) ||
      fallback
    );
  }
}
