import fsPath from "path";
import BaseModule from "../../core/baseModule";
import config from "../../decorators/config";
import { Template, TemplateData } from "./engine";
import dependsOn from "../../decorators/dependsOn";
import fs from "node:fs/promises";

interface NodeError extends Error {
  code?: string;
}

/**
 * Manages server-side rendering of templates. It provides functionality to render templates with dynamic data,
 * supporting a flexible templating engine that can integrate with the application's overall routing and response
 * handling mechanism.
 */
@dependsOn(["RequestParser", "StaticFiles"])
export default class Templates extends BaseModule {
  @config()
  templateRoot: string = "/templates";

  private _template!: Template;

  async init() {
    this.templateRoot = fsPath.join(this.base.fsRoot, this.templateRoot);
    this.logger.log(`Template path: ${this.templateRoot}`);

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
