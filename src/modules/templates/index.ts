import fsPath from "path";
import BaseModule from "../../core/baseModule";
import { Template, TemplateData } from "./engine";
import fs from "node:fs/promises";

import di from "../../decorators/di";
import init from "../../decorators/actions/init";
import config from "../../decorators/config";

interface NodeError extends Error {
  code?: string;
}

export default class BaseTemplates extends BaseModule {
  private _template: Template | undefined;

  @di("fsRoot")
  accessor baseFsRoot!: string;

  @config<string>()
  private templateRoot: string = "templates";

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

  public render(template: string, data?: TemplateData): string {
    if (!this._template)
      throw new Error(
        `Template engine not initialized. Does template path exist? ${this.templateRoot}`,
      );
    return this._template.render(template, data ?? {});
  }
}
