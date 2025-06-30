import { registerDi } from "../../di/decorators/registerDi";
import { type LogObjectTransformer } from "../types";

export function logSerializer() {
  return (target: new () => LogObjectTransformer,  context: ClassDecoratorContext) => {
    registerDi({
      singleton: true,
      tags: ['Logger:Serializer'],
    })(target, context);
  };
}
