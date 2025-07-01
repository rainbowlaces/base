import fsPath from "path";
import { Template } from "./engine";
import fs from "node:fs/promises";

import { di } from "../../core/di/decorators/di";
import { baseModule } from "../../core/module/decorators/baseModule";
import { BaseModule } from "../../core/module/baseModule";

@baseModule
export class BaseTemplates extends BaseModule {
  private template: Template | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Templates need to accept any data structure
  public render(_template: string, _data?: any): string {
    return "";
  }
}
