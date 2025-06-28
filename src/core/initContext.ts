import { register } from "../decorators/register";
import { BaseContext } from "./baseContext";

type InitContextData = object;

@register()
export class BaseInitContext extends BaseContext<InitContextData> {
  constructor() {
    super(
      (id: string, module: string, action: string, status: string) =>
        `/base/init/${id}/${module}/${action}/${status}`,
    );

    // Trigger RFA coordination flow
    this._coordinateAndRun().catch((error: unknown) => {
      console.error("Init context coordination failed:", error);
      this.error();
    });
  }

  protected getContextType(): string {
    return "init";
  }
}
