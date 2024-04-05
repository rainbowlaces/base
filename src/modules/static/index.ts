import { Request, Response, NextFunction } from "express";
import fsPath from "path";
import crypto from "crypto";
import ts from "typescript";
import * as fs from "fs";
import * as babel from "@babel/core";

import * as t from "@babel/types";
import * as mime from "mime-types";

import BaseModule from "../../core/baseModule";
import config from "../../decorators/config";
import middleware from "../../decorators/middleware";
import path from "../../decorators/path";
import dependsOn from "../../decorators/dependsOn";
import method from "../../decorators/method";
import HttpError from "../../core/httpError";
import command from "../../decorators/command";
import { resolveModule } from "./utils";
import { findFileUp, loadFile } from "../../utils/file";

interface FileRequest extends Request {
  data?: Buffer | string;
  stats?: fs.Stats;
  filePath?: string;
  root?: string;
  ts?: boolean;
  js?: boolean;
  fileRequest?: boolean;
}

interface NodeError extends Error {
  code?: string;
}

/**
 * Serves static files and npm modules directly to clients. It handles file requests with support for TypeScript
 * and JavaScript files, including on-the-fly compilation and import path resolution, to facilitate development
 * and deployment of front-end assets.
 */
export default class StaticFiles extends BaseModule {
  @config()
  staticFsRoot: string = "/public";

  @config()
  npmFsRoot: string = "";

  @config()
  maxAge: number = 0;

  @config()
  moduleAccessFilter: (string | RegExp)[] = [];

  @config()
  accessMode: "open" | "closed" = "closed";

  async init() {
    this.staticFsRoot = fsPath.normalize(
      fsPath.join(this.base.fsRoot, this.staticFsRoot),
    );

    if (!this.npmFsRoot.trim()) {
      try {
        this.npmFsRoot =
          (await findFileUp(this.base.fsRoot, "package.json")) ?? "";
        this.npmFsRoot = this.npmFsRoot
          ? fsPath.join(fsPath.dirname(this.npmFsRoot), "node_modules")
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
      this.npmFsRoot = fsPath.normalize(this.npmFsRoot);
    }

    this.maxAge = Number(this.maxAge);
    this.logger.debug(`Static files path: ${this.staticFsRoot}`);
    this.logger.debug(`NPM modules path: ${this.npmFsRoot}`);
    this.logger.debug(`Max age: ${this.maxAge}`);
    this.logger.debug(`Access Mode: ${this.accessMode}`);
    this.logger.debug(`Namespace: ${this.namespace}`);
  }

  async getFile(
    path: string,
  ): Promise<{ data: Buffer; stats: fs.Stats; type: string }> {
    const data = await loadFile(path);
    return { ...data, type: mime.lookup(path) || "application/octet-stream" };
  }

  async getFileBase64(path: string): Promise<{ data: string; type: string }> {
    const data = await this.getFile(path);
    return {
      data: data.data.toString("base64"),
      type: data.type,
    };
  }

  @middleware
  @path("/npm/(.+)")
  @method("get")
  async handleNpm(
    req: FileRequest,
    res: Response,
    next: NextFunction,
  ): Promise<unknown> {
    const params = req.params;
    if (!params || !params[0]) return next();
    const { module, cleanPath } = this.parseModuleName(params[0]);

    this.logger.info(`Module(${module}) requested`);

    if (module && !this.isModuleAccessible(module)) {
      this.logger.info(`Module(${module}) is not accessible`);
      res.status(403).send("Forbidden");
      return;
    }

    try {
      req.filePath = await resolveModule(cleanPath, this.npmFsRoot);
    } catch (err) {
      this.logger.info(`Module(${module}) not found in ${this.npmFsRoot}`, [], {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        e: (err as any).stack,
      });
      res.status(404).send("Not found");
      return;
    }

    req.root = this.npmFsRoot;
    req.fileRequest = true;

    this.logger.info(
      `Module(${module}) found in ${req.root} at path ${req.filePath}`,
    );

    return this.commands("static").run(req, res, next);
  }

  @middleware
  @path("/static/(.+)")
  @method("get")
  async handleStatic(
    req: FileRequest,
    res: Response,
    next: NextFunction,
  ): Promise<unknown> {
    const params = req.params;
    if (!params || !params[0]) return next();

    const cleanPath = this.cleanPath(params[0]).join("/");

    if (!cleanPath) return next();

    req.filePath = fsPath.normalize(fsPath.join(this.staticFsRoot, cleanPath));
    req.root = this.staticFsRoot;
    req.fileRequest = true;

    return this.commands("static").run(req, res, next);
  }

  @command(["static"])
  async handleFile(req: FileRequest, res: Response, done: () => void) {
    if (!req.fileRequest || !req.filePath || !req.root) return done();

    if (!req.filePath.startsWith(req.root)) {
      this.logger.warn(
        `Filepath(${req.filePath}) is outside of root(${req.root})`,
      );
      res.status(403).send("Forbidden");
      return;
    }

    try {
      const { data, stats } = await loadFile(req.filePath);
      req.data = data;
      req.stats = stats;
    } catch (err) {
      const error = err as NodeError;
      if (error.message === "NOT FOUND" || error.code === "ENOENT") {
        this.logger.info(`Filepath(${req.filePath}) not found`);
        return done();
      } else {
        throw new HttpError(500, error);
      }
    }
  }

  @dependsOn("handleFile")
  @command(["static"])
  async handleTsJs(req: FileRequest) {
    req.ts = !!req.filePath?.endsWith(".ts");
    req.js = !!req.filePath?.endsWith(".js");
  }

  @dependsOn(["handleTsJs"])
  @command(["static"])
  async handleTypeScript(req: FileRequest, res: Response, done: () => void) {
    if (!req.fileRequest) return done();
    if (!req.ts || !req.data) return;
    try {
      req.data = this.compileTsFile(req.data as Buffer);
      req.data = this.replaceImportPaths(req.data, req.filePath ?? "");
      req.ts = false;
      req.js = true;
    } catch (err) {
      throw new HttpError(500, err as Error);
    }
  }

  @command(["static"])
  @dependsOn(["handleTypeScript"])
  async handleJavaScript(req: FileRequest, res: Response, done: () => void) {
    if (!req.fileRequest) return done();
    if (!req.js || !req.data) return;
    try {
      req.data = this.replaceImportPaths(
        req.data.toString("utf8"),
        req.filePath ?? "",
      );
    } catch (err) {
      throw new HttpError(500, err as Error);
    }
  }

  @command(["static"])
  @dependsOn(["handleFile", "handleTypeScript", "handleJavaScript"])
  async sendFile(req: FileRequest, res: Response, done: () => void) {
    if (!req.fileRequest || !req.data || !req.stats) return done();

    // Generate ETag
    const hash = crypto.createHash("sha1");
    hash.update(req.data);
    const etag = hash.digest("hex");

    // Check If-None-Match header
    if (req.headers["if-none-match"] === etag) {
      this.logger.debug(`Filepath(${req.filePath}) has not been modified`);
      res.sendStatus(304);
      return;
    }

    // Check If-Modified-Since header
    const modifiedSince = req.headers["if-modified-since"];
    if (
      modifiedSince &&
      new Date(modifiedSince).getTime() >= req.stats.mtime.getTime()
    ) {
      this.logger.debug(
        `Filepath(${req.filePath}) not modified since ${modifiedSince}`,
      );
      res.sendStatus(304);
      return;
    }

    let mimeType: string;
    if (req.ts || req.js) {
      mimeType = "application/javascript";
    } else {
      mimeType =
        mime.lookup(req.filePath as string) || "application/octet-stream";
    }

    res.set("Content-Type", mimeType);
    res.set("ETag", etag);
    res.set("Last-Modified", req.stats.mtime.toUTCString());
    res.set("Cache-Control", `public, max-age=${this.maxAge}`);
    res.send(req.data);
    this.logger.debug(`Filepath(${req.filePath}) served`);
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

  private compileTsFile(data: Buffer): string {
    const fileContents = data.toString("utf8");
    const result = ts.transpileModule(fileContents, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      },
    });
    return result.outputText;
  }

  private replaceImportPaths(js: string, filePath: string): string {
    let ast;
    try {
      ast = babel.parse(js, {
        sourceType: "module",
        filename: filePath,
      });
    } catch (err) {
      this.logger.error("Failed to parse JS content.", [], { err });
      throw new HttpError(500, err);
    }

    if (!ast) throw new Error("ast is undefined");

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

    const output = babel.transformFromAstSync(ast, js, { filename: filePath });
    if (!output) throw new Error("Failed to transform JS content.");

    return output.code as string;
  }

  private cleanPath(path: string): string[] {
    if (typeof path !== "string") return [];
    if (!path || !path.trim()) return [];
    return path
      .trim()
      .split("/")
      .filter((s: string) => !!s);
  }

  private parseModuleName(moduleName: string): {
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
}
