import { registerDi } from "../../di/decorators/registerDi.js";
import { type LogObjectTransformer } from "../types.js";

export function logSerializer() {
  return (target: new () => LogObjectTransformer,  context: ClassDecoratorContext) => {
    registerDi({
      singleton: true,
      tags: ['Logger:Serializer'],
    })(target, context);
  };
}
