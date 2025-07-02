import { registerDi } from "../di/decorators/registerDi";
import { BaseContext } from "./baseContext";

type InitContextData = object;

@registerDi()
export class BaseInitContext extends BaseContext<InitContextData> {
  constructor() {
    super(
      (id: string, module: string, action: string, status: string) =>
        `/base/init/${id}/${module}/${action}/${status}`,
    );

    this.coordinateAndRun("/init").catch((error: unknown) => {
      console.error("Init context coordination failed:", error);
      this.error();
    });
  }

  protected getContextType(): string {
    return "init";
  }
}
