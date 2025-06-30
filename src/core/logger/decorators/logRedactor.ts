import { registerDi } from "../../di/decorators/registerDi";
import { type LogObjectTransformer } from "../types";

export function redactor() {
  return (target: new () => LogObjectTransformer, context: ClassDecoratorContext) => {
    registerDi({
      singleton: true,
      tags: ['Logger:Redactor'],
    })(target, context);
  };
}