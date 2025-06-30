import fsPath from "path";
import { Template } from "./engine";
import fs from "node:fs/promises";

import { di } from "../../core/di/decorators/di";
import { baseModule } from "../../core/module/decorators/baseModule";
import { BaseModule } from "../../core/module/baseModule";

interface NodeError extends Error {
  code?: string;
}

@baseModule
export class BaseTemplates extends BaseModule {
  private template: Template | undefined;

  @di("fsRoot")
  accessor baseFsRoot!: string;

  // TODO: This will be configured via typed config system
  private templateRoot = "templates";

  async setup(): Promise<void> {
      this.templateRoot = fsPath.join(this.baseFsRoot, this.templateRoot);
      this.logger.debug(`Template path: ${this.templateRoot}`);
      try {
        await fs.access(this.templateRoot);
        this.template = new Template(this.templateRoot);
        await this.template.init();
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
    if (!this.template)
      throw new Error(
        `Template engine not initialized. Does template path exist? ${this.templateRoot}`,
      );
    return this.template.render(template, data ?? {});
  }
}
