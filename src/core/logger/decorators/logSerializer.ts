import { registerDi } from "../../di/baseDi";
import { type LogObjectTransformer } from "../types";

export function logSerializer() {
  return (target: new () => LogObjectTransformer,  context: ClassDecoratorContext) => {
    registerDi({
      singleton: true,
      tags: ['Logger:Serializer'],
    })(target, context);
  };
}
