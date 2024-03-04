import { Request, Response, NextFunction } from "express";
import fsPath from "path";
import crypto from "crypto";
import * as ts from "typescript";
import * as fs from "fs";
import * as babel from "@babel/core";

// eslint-disable-next-line node/no-unpublished-import
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
  npmFsRoot: string = "../../node_modules";

  @config()
  maxAge: number = 0;

  @config()
  moduleAccessFilter: string[] = [];

  @config()
  accessMode: "open" | "closed" = "closed";

  async init() {
    this.staticFsRoot = fsPath.normalize(
      fsPath.join(this.base.fsRoot, this.staticFsRoot),
    );
    this.npmFsRoot = fsPath.normalize(
      fsPath.join(this.base.fsRoot, this.npmFsRoot),
    );
    this.maxAge = Number(this.maxAge);
    this.logger.debug(`Static files path: ${this.staticFsRoot}`);
    this.logger.debug(`NPM modules path: ${this.npmFsRoot}`);
    this.logger.debug(`Max age: ${this.maxAge}`);
  }

  @middleware
  @path("/npm")
  @method("get")
  async handleNpm(req: FileRequest, res: Response, next: NextFunction) {
    const { module, cleanPath } = this.parseModuleName(req.path);

    if (module && !this.isModuleAccessible(module)) {
      this.logger.info(`Module(${module}) is not accessible`);
      res.status(403).send("Forbidden");
      return;
    }

    let filePath: string;
    try {
      filePath = require.resolve(cleanPath, { paths: [this.npmFsRoot] });
    } catch (err) {
      this.logger.info(`Module(${module}) not found in ${this.npmFsRoot}`);
      return;
    }

    req.filePath = filePath;
    req.root = this.npmFsRoot;
    req.fileRequest = true;

    return this.commands("npm").run(req, res, next);
  }

  @middleware
  @path("/static")
  @method("get")
  async handleStatic(
    req: FileRequest,
    res: Response,
    next: NextFunction,
  ): Promise<unknown> {
    const cleanPath = this.cleanPath(req.path).join("/");
    if (!cleanPath) return next();

    req.filePath = fsPath.normalize(fsPath.join(this.staticFsRoot, req.path));
    req.root = this.staticFsRoot;
    req.fileRequest = true;

    return this.commands("static").run(req, res, next);
  }

  @command(["static", "npm"])
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
      const { data, stats } = await this.loadFile(req.filePath);
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
  @command(["static", "npm"])
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
      req.ts = false;
      req.js = true;
    } catch (err) {
      throw new HttpError(500, err as Error);
    }
  }

  @command(["static", "npm"])
  @dependsOn(["handleTypeScript"])
  async handleJavaScript(req: FileRequest, res: Response, done: () => void) {
    if (!req.fileRequest) return done();
    if (!req.js || !req.data) return;
    try {
      req.data = this.replaceImportPaths(req.data.toString("utf8"));
    } catch (err) {
      throw new HttpError(500, err as Error);
    }
  }

  @command(["static", "npm"])
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
      return !this.moduleAccessFilter.includes(moduleName);
    } else {
      return this.moduleAccessFilter.includes(moduleName);
    }
  }

  private compileTsFile(data: Buffer): string {
    const fileContents = data.toString("utf8");
    const result = ts.transpileModule(fileContents, {
      compilerOptions: {
        module: ts.ModuleKind.ES2015,
        target: ts.ScriptTarget.ES2015,
      },
    });
    return this.replaceImportPaths(result.outputText);
  }

  private replaceImportPaths(js: string): string {
    const ast = babel.parse(js, { sourceType: "module" });
    if (!ast) throw new Error("Failed to parse JS content.");

    const replacePath = (
      path: babel.NodePath<
        | babel.types.ImportDeclaration
        | babel.types.ExportAllDeclaration
        | babel.types.ExportNamedDeclaration
        | babel.types.CallExpression
      >,
    ) => {
      let importPath: string;
      const hasFileExtension = /\.[0-9a-z]+$/i;

      if (
        t.isImportDeclaration(path.node) ||
        t.isExportAllDeclaration(path.node) ||
        t.isExportNamedDeclaration(path.node)
      ) {
        importPath = path.node.source?.value as string;
        if (!importPath) throw new Error("importPath is undefined");

        if (
          importPath &&
          !importPath.startsWith(".") &&
          !importPath.startsWith("/")
        ) {
          path.node.source = t.stringLiteral(`/npm/${importPath}`);
        } else if (importPath && !hasFileExtension.test(importPath)) {
          path.node.source = t.stringLiteral(`${importPath}.ts`);
        }
      } else if (
        t.isCallExpression(path.node) &&
        t.isImport(path.node.callee) &&
        t.isStringLiteral(path.node.arguments?.[0])
      ) {
        importPath = path.node.arguments[0]?.value;
        if (
          importPath &&
          !importPath.startsWith(".") &&
          !importPath.startsWith("/")
        ) {
          path.node.arguments[0] = t.stringLiteral(`/npm/${importPath}`);
        } else if (importPath && !hasFileExtension.test(importPath)) {
          path.node.arguments[0] = t.stringLiteral(`${importPath}.ts`);
        }
      }
    };

    babel.traverse(ast, {
      ImportDeclaration: replacePath,
      ExportAllDeclaration: replacePath,
      ExportNamedDeclaration: replacePath,
      CallExpression: replacePath,
    });

    const output = babel.transformFromAstSync(ast, js);
    if (!output) throw new Error("Failed to transform JS content.");

    return output.code as string;
  }

  private cleanPath(path: string): string[] {
    return path.split("/").filter((s: string) => !!s);
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

  private async loadFile(
    file: string,
  ): Promise<{ data: Buffer; stats: fs.Stats }> {
    const [data, stats] = await Promise.all([
      fs.promises.readFile(file),
      fs.promises.stat(file),
    ]);
    return { data, stats };
  }
}
