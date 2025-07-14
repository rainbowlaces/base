import { registerDi } from "../di/decorators/registerDi.js";
import { BaseContext } from "./baseContext.js";

type InitContextData = object;

@registerDi()
export class BaseInitContext extends BaseContext<InitContextData> {
  constructor() {
    super(
      (id: string, module: string, action: string, status: string) =>
        `/base/init/${id}/${module}/${action}/${status}`,
    );

    this.coordinateAndRun("/init").catch(() => {
      this.error();
    });
  }

  protected getContextType(): string {
    return "init";
  }
}
