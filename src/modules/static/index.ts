import init from "../../decorators/actions/init";
import BaseModule from "../../core/baseModule";
import di from "../../decorators/di";
import path from "path";
import { findFileUp, loadFile } from "../../utils/file";
import request from "../../decorators/actions/request";
import module from "../../decorators/module";
import { BaseHttpActionArgs } from "../../core/baseAction";
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

@module
export default class BaseStatic extends BaseModule {
  @di("fsRoot")
  accessor baseFsRoot!: string;

  @config<string>()
  staticFsRoot = "/public";

  @config<string>()
  npmFsRoot = "";

  @config<number>()
  maxAge = 3600;

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

  @request("/get/npm/:module*")
  async handleNpmModule(args: BaseHttpActionArgs) {
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
      ctx.data.filePath = await resolveModule(cleanPath, this.npmFsRoot);
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

    ctx.data.root = this.npmFsRoot;
    ctx.data.fileRequest = true;

    this.logger.info(
      `Module(${module}) found in ${ctx.data.root} at path ${ctx.data.filePath}`,
      [ctx.id],
    );
  }

  @request("/get/static/:path*")
  async handleStatic(args: BaseHttpActionArgs) {
    const ctx = args.context;
    const cleanPath = this.cleanPath(args?.path as string | string[]).join("/");

    if (!cleanPath) return;

    ctx.data.filePath = path.normalize(path.join(this.staticFsRoot, cleanPath));
    ctx.data.root = this.staticFsRoot;
    ctx.data.fileRequest = true;

    return;
  }

  @dependsOn("/handleStatic")
  @request("/get/static/:path*")
  async handleStaticFile(args: BaseHttpActionArgs) {
    return this.handleFile(args);
  }

  @dependsOn("/handleNpmModule")
  @request("/get/npm/:module*")
  async handleNpmFile(args: BaseHttpActionArgs) {
    return this.handleFile(args);
  }

  private async handleFile(args: BaseHttpActionArgs) {
    const ctx = args.context;

    const filePath = (ctx.data.filePath || "") as string;
    const root = (ctx.data.root || "") as string;

    if (!ctx.data.fileRequest || !filePath || !root) {
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
      ctx.data.data = data;
      ctx.data.stats = stats;
      ctx.data.js = !!filePath?.endsWith(".js");
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

  @dependsOn("/handleStaticFile")
  @request("/get/static/:path*")
  async handleStaticJavaScript(args: BaseHttpActionArgs) {
    return this.handleJavaScript(args);
  }

  @dependsOn("/handleNpmFile")
  @request("/get/npm/:module*")
  async handleNpmJavaScript(args: BaseHttpActionArgs) {
    return this.handleJavaScript(args);
  }

  private async handleJavaScript(args: BaseHttpActionArgs) {
    const ctx = args.context;

    if (!ctx.data.fileRequest) {
      ctx.res.statusCode(400);
      ctx.res.send("Bad request");
      return;
    }

    if (!ctx.data.js) return;

    const filePath: string = (ctx.data.filePath || "") as string;
    let data: Buffer | string | undefined = ctx.data.data as Buffer | string;

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
      ctx.data.data = data;
    } catch (err) {
      this.logger.error("Failed to replace import paths.", [], { err });
      ctx.res.statusCode(500);
      ctx.res.send("Failed to replace import paths.");
    }
  }

  @dependsOn("/handleStaticJavaScript")
  @request("/get/static/:path*")
  async sendStaticFile(args: BaseHttpActionArgs) {
    return this.sendFile(args);
  }

  @dependsOn("/handleNpmJavaScript")
  @request("/get/npm/:module*")
  async sendNpmFile(args: BaseHttpActionArgs) {
    return this.sendFile(args);
  }

  async sendFile(args: BaseHttpActionArgs) {
    const ctx = args.context;
    if (!ctx.data.fileRequest) return;

    const filePath: string = (ctx.data.filePath || "") as string;
    const data: Buffer | string | undefined = ctx.data.data as Buffer | string;
    const stats: fs.Stats | undefined = ctx.data.stats as fs.Stats | undefined;

    if (!data || !stats) return;

    // Generate ETag
    const hash = crypto.createHash("sha1");

    // Ensure the argument matches BinaryLike
    hash.update(typeof data === "string" ? data : new Uint8Array(data));
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
    if (ctx.data.js) {
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
            } else if (importPath.startsWith(".")) {
              path.node.source.value = `${importPath}${importPath.endsWith(".js") ? "" : ".js"}`;
            }
          }
        }
      } else if (
        t.isCallExpression(path.node) &&
        t.isStringLiteral(path.node.arguments[0])
      ) {
        importPath = path.node.arguments[0].value;
        if (importPath.startsWith(".")) {
          path.node.arguments[0].value = `${importPath}${importPath.endsWith(".js") ? "" : ".js"}`;
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
