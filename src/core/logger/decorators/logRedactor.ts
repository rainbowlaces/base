import { registerDi } from "../../di/baseDi";
import { LogObjectTransformer } from "../types";

export function redactor() {
  return (target: new () => LogObjectTransformer, context: ClassDecoratorContext) => {
    registerDi({
      singleton: true,
      tags: ['Logger:Redactor'],
    })(target, context);
  };
}