import fsPath from "path";
import { BaseModule } from "../../core/baseModule";
import { Template } from "./engine";
import fs from "node:fs/promises";

import { di } from "../../core/di/decorators/di";
import { init } from "../../decorators/actions/init";
import { baseModule } from "../../decorators/baseModule";

interface NodeError extends Error {
  code?: string;
}

@baseModule
export class BaseTemplates extends BaseModule {
  private _template: Template | undefined;

  @di("fsRoot")
  accessor baseFsRoot!: string;

  // TODO: This will be configured via typed config system
  private templateRoot = "templates";

  @init()
  async init() {
    this.templateRoot = fsPath.join(this.baseFsRoot, this.templateRoot);
    this.logger.debug(`Template path: ${this.templateRoot}`);

    try {
      await fs.access(this.templateRoot);
      this._template = new Template(this.templateRoot);
      await this._template.init();
    } catch (e) {
       
      const err = e as NodeError;
      if (err.code === "ENOENT") {
        this.logger.warn(
          `Template path does not exist, Templates not initialised.`,
        );
        return;
      }
      this.logger.warn(
        `Error initialising template engine: ${err.message}.`,
        [],
        { e },
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Templates need to accept any data structure
  public render(template: string, data?: any): string {
    if (!this._template)
      throw new Error(
        `Template engine not initialized. Does template path exist? ${this.templateRoot}`,
      );
    return this._template.render(template, data ?? {});
  }
}
