import init from "../../decorators/init";
import BaseModule from "../../core/baseModule";
import di from "../../decorators/di";
import path from "path";
import { findFileUp, loadFile } from "../../utils/file";
import action from "../../decorators/action";
import { BaseActionArgs } from "../../core/baseAction";
import { resolveModule } from "./utils";
import dependsOn from "../../decorators/dependsOn";
import BaseError from "../../core/baseErrors";

import crypto from "crypto";

import babel from "@babel/core";
import * as t from "@babel/types";
import * as fs from "fs";
import mime from "mime-types";
import config from "../../decorators/config";

type ModuleAccessFilter = (string | RegExp)[];
type ModileAccessType = "open" | "closed";

interface NodeError extends Error {
  code?: string;
}

export default class BaseStatic extends BaseModule {
  @di("fsRoot")
  baseFsRoot!: string;

  @config<string>()
  staticFsRoot: string = "/public";

  @config<string>()
  npmFsRoot: string = "";

  @config<number>()
  maxAge: number = 3600;

  @config<ModuleAccessFilter>()
  moduleAccessFilter: ModuleAccessFilter = [];

  @config<ModileAccessType>()
  accessMode: ModileAccessType = "closed";

  @init()
  async init() {
    this.staticFsRoot = path.normalize(
      path.join(this.baseFsRoot, this.staticFsRoot),
    );

    if (!this.npmFsRoot.trim()) {
      try {
        this.npmFsRoot =
          (await findFileUp(this.baseFsRoot, "package.json")) ?? "";
        this.npmFsRoot = this.npmFsRoot
          ? path.join(path.dirname(this.npmFsRoot), "node_modules")
          : "";
      } catch (err) {
        this.logger.error("Error resolving package.json.", [], { err });
      }
    }

    if (!this.npmFsRoot) {
      this.logger.error(
        "Failed to resolve npmFsRoot, npm modules will not be accessible.",
      );
    } else {
      this.npmFsRoot = path.normalize(this.npmFsRoot);
    }
  }

  @action("/get/npm/:module*")
  async handleNpmModule(args?: BaseActionArgs) {
    if (!args || !args.module) return;
    if (!args.context) return;
    const ctx = args.context;

    const { module, cleanPath } = this.parseModuleName(
      args?.module as string | string[],
    );
    this.logger.info(`Module(${module}) requested`, [ctx.id]);

    if (module && !this.isModuleAccessible(module)) {
      this.logger.info(`Module(${module}) is not accessible`, [ctx.id]);
      ctx.res.statusCode(403);
      ctx.res.send("Forbidden");
      return;
    }

    try {
      ctx.set("filePath", await resolveModule(cleanPath, this.npmFsRoot));
    } catch (err) {
      this.logger.info(
        `Module(${module}) not found in ${this.npmFsRoot}`,
        [ctx.id],
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          e: (err as any).stack,
        },
      );
      ctx.res.statusCode(404);
      ctx.res.send("Not found");
      return;
    }

    ctx.set("root", this.npmFsRoot);
    ctx.set("fileRequest", true);

    this.logger.info(
      `Module(${module}) found in ${ctx.get("root")} at path ${ctx.get("filePath")}`,
      [ctx.id],
    );
  }

  @action("/get/static/:path*")
  async handleStatic(args?: BaseActionArgs) {
    if (!args || !args.path) return;
    if (!args.context) return;
    const ctx = args.context;
    const cleanPath = this.cleanPath(args?.path as string | string[]).join("/");

    if (!cleanPath) return;

    ctx.set(
      "filePath",
      path.normalize(path.join(this.staticFsRoot, cleanPath)),
    );
    ctx.set("root", this.staticFsRoot);
    ctx.set("fileRequest", true);

    return;
  }

  @dependsOn("/(handleStatic|handleNpmModule)")
  @action("/get/(static|npm)/:path*")
  async handleFile(args?: BaseActionArgs) {
    if (!args || !args.context) return;
    const ctx = args.context;

    const filePath: string = ctx.get("filePath") || "";
    const root: string = ctx.get("root") || "";

    if (!ctx.get("fileRequest") || !filePath || !root) {
      ctx.res.statusCode(400);
      ctx.res.send("Bad request");
      return;
    }

    if (!filePath.startsWith(root)) {
      this.logger.warn(`Filepath(${filePath}) is outside of root(${root})`, [
        ctx.id,
      ]);
      ctx.res.statusCode(403);
      ctx.res.send("Forbidden");
      return;
    }

    try {
      const { data, stats } = await loadFile(filePath);
      ctx.set("data", data);
      ctx.set("stats", stats);
      ctx.set("js", !!filePath?.endsWith(".js"));
    } catch (err) {
      const error = err as NodeError;
      if (error.message === "NOT FOUND" || error.code === "ENOENT") {
        this.logger.info(`Filepath(${filePath}) not found`, [ctx.id]);
        ctx.res.statusCode(404);
        ctx.res.send("Not found");
        return;
      } else {
        throw new BaseError(error);
      }
    }
    return;
  }

  @dependsOn("/handleFile")
  @action("/get/(static|npm)/:path*")
  async handleJavaScript(args?: BaseActionArgs) {
    if (!args || !args.context) return;
    const ctx = args.context;

    if (!ctx.get("fileRequest")) {
      ctx.res.statusCode(400);
      ctx.res.send("Bad request");
      return;
    }

    if (!ctx.get("js")) return;

    const filePath: string = ctx.get("filePath") || "";
    let data: Buffer | string | undefined = ctx.get<Buffer>("data");

    if (!data) {
      ctx.res.statusCode(400);
      ctx.res.send("Bad request");
      return;
    }

    this.logger.debug(`Processing file: ${filePath}`, [ctx.id]);

    try {
      data = await this.replaceImportPaths(
        data.toString("utf8"),
        filePath ?? "",
      );
      ctx.set("data", data);
    } catch (err) {
      this.logger.error("Failed to replace import paths.", [], { err });
      ctx.res.statusCode(500);
      ctx.res.send("Failed to replace import paths.");
    }
  }

  @dependsOn("/handleJavaScript")
  @action("/get/(static|npm)/:path*")
  async sendFile(args?: BaseActionArgs) {
    if (!args || !args.context) return;
    const ctx = args.context;

    if (!ctx.get("fileRequest")) return;

    const filePath: string = ctx.get("filePath") || "";
    const data: Buffer | string | undefined = ctx.get<Buffer>("data");
    const stats: fs.Stats | undefined = ctx.get<fs.Stats>("stats");

    if (!data || !stats) return;

    // Generate ETag
    const hash = crypto.createHash("sha1");
    hash.update(data);
    const etag = hash.digest("hex");

    if (ctx.req.header("if-none-match") === etag) {
      this.logger.debug(`Filepath(${filePath}) has not been modified`, [
        ctx.id,
      ]);

      ctx.res.statusCode(304);
      ctx.res.send("Not Modified");
      return;
    }

    // Check If-Modified-Since header
    const modifiedSince = ctx.req.header("if-modified-since");
    if (
      modifiedSince &&
      new Date(modifiedSince).getTime() >= stats.mtime.getTime()
    ) {
      this.logger.debug(
        `Filepath(${filePath}) not modified since ${modifiedSince}`,
        [ctx.id],
      );
      ctx.res.statusCode(304);
      ctx.res.send("Not Modified");
      return;
    }

    let mimeType: string;
    if (ctx.get("js")) {
      mimeType = "application/javascript";
    } else {
      mimeType = mime.lookup(filePath as string) || "application/octet-stream";
    }

    ctx.res.header("ETag", etag);
    ctx.res.header("Last-Modified", stats.mtime.toUTCString());
    ctx.res.header("Cache-Control", `public, max-age=${this.maxAge}`);
    ctx.res.send(data, mimeType);
    this.logger.debug(`Filepath(${filePath}) served`, [ctx.id]);
    return;
  }

  private isModuleAccessible(moduleName: string): boolean {
    if (this.accessMode === "open") {
      return !this.moduleInAccessList(moduleName);
    } else {
      return this.moduleInAccessList(moduleName);
    }
  }

  private moduleInAccessList(moduleName: string): boolean {
    if (this.moduleAccessFilter.includes(moduleName)) return true;
    return this.moduleAccessFilter
      .filter((f) => f instanceof RegExp)
      .some((f) => {
        return (f as RegExp).test(moduleName);
      });
  }

  private cleanPath(path: string | string[]): string[] {
    if (Array.isArray(path)) path = path.join("/");
    if (typeof path !== "string") return [];
    if (!path || !path.trim()) return [];
    return path
      .trim()
      .split("/")
      .filter((s: string) => !!s);
  }

  private parseModuleName(moduleName: string | string[]): {
    module: string;
    cleanPath: string;
  } {
    const segments: string[] = this.cleanPath(moduleName);

    if (!segments.length) return { module: "", cleanPath: "" };

    let module;

    if (segments[0].startsWith("@")) {
      module = segments.slice(0, 2).join("/");
    } else {
      module = segments[0];
    }

    return { module, cleanPath: segments.join("/") };
  }

  private async replaceImportPaths(
    js: string,
    filePath: string,
  ): Promise<string> {
    let ast;
    try {
      ast = await babel.parseAsync(js, {
        sourceType: "module",
        filename: filePath,
        babelrc: false,
        configFile: false,
      } as babel.ParserOptions);
    } catch (err) {
      throw new BaseError("Failed to parse JS content.", err as Error);
    }

    if (!ast) throw new BaseError("AST is undefined.");

    const replacePath = (
      path: babel.NodePath<
        | babel.types.ImportDeclaration
        | babel.types.ExportAllDeclaration
        | babel.types.ExportNamedDeclaration
        | babel.types.CallExpression
      >,
    ) => {
      let importPath: string;
      if (
        t.isImportDeclaration(path.node) ||
        t.isExportAllDeclaration(path.node) ||
        t.isExportNamedDeclaration(path.node)
      ) {
        if (path.node.source) {
          importPath = path.node.source.value;
          if (importPath) {
            if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
              path.node.source.value = `/npm/${importPath}${importPath.endsWith(".js") ? "" : "/"}`;
            }
          }
        }
      }
    };

    babel.traverse(ast, {
      ImportDeclaration: replacePath,
      ExportAllDeclaration: replacePath,
      ExportNamedDeclaration: replacePath,
      CallExpression: replacePath,
    });

    let output;
    try {
      output = await babel.transformFromAstAsync(ast, js, {
        sourceType: "module",
        filename: filePath,
        babelrc: false,
        configFile: false,
      });
    } catch (err) {
      throw new BaseError("Failed to transform JS content.", err as Error);
    }

    if (!output) throw new BaseError("Failed to transform JS.");

    return output.code as string;
  }
}
