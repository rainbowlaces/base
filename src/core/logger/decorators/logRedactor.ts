import { registerDi } from "../../di/decorators/registerDi.js";
import { type LogObjectTransformer } from "../types.js";

export function redactor() {
  return (target: new () => LogObjectTransformer, context: ClassDecoratorContext) => {
    registerDi({
      singleton: true,
      tags: ['Logger:Redactor'],
    })(target, context);
  };
}