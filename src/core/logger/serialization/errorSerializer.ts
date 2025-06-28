import { type LogError, type TypeSerializer, type TypeSerializerConfig } from "../types";
import { register } from "../../../decorators/register";

@register()
export class ErrorSerializer implements TypeSerializer<Error> {
  config: TypeSerializerConfig = {};

  canSerialize(input: unknown): input is Error {
    return input instanceof Error;
  }

  serialize(error: Error): LogError {
    return {
      message: error.message,
      stack: error.stack
        ?.split("\n")
        .slice(1)
        .map((s) => s.trim().substring(3)),
    };
  }
}
