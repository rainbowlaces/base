import path from "path";
import crypto from "crypto";
import type * as fs from "fs";
import mime from "mime-types";
import { BaseClassConfig, type ConfigData } from "../../core/config/types.js";
import { configClass } from "../../core/config/decorators/provider.js";
import { BaseModule } from "../../core/module/baseModule.js";
import { di } from "../../core/di/baseDi.js";
import { BaseError } from "../../core/baseErrors.js";
import { loadFile } from "../../utils/file.js";
import { request } from "../../core/requestHandler/decorators/request.js";
import { type BaseHttpActionArgs } from "../../core/requestHandler/types.js";
import { NodeFileSystem, type FileSystem } from "../../utils/fileSystem.js";
import { registerDi } from "../../core/di/decorators/registerDi.js";

interface NodeError extends Error {
  code?: string;
}

@configClass("BaseStatic")
export class BaseStaticConfig extends BaseClassConfig {
  staticFsRoot: string = "/public";
  maxAge: number = 3600; 
}

// Declaration merging to add the logger config to the global app config type.
declare module "../../core/config/types.js" {
  interface BaseAppConfig {
    BaseStatic?: ConfigData<BaseStaticConfig>;
  }
}

@registerDi({setup: true, singleton: true, teardown: true, phase: 30, tags: ["Module"]})
export class BaseStatic extends BaseModule<BaseStaticConfig> {
  @di("fsRoot")
  accessor baseFsRoot!: string;
  staticFsRoot: string = "";
  fileSystem: FileSystem;

  constructor(fs: FileSystem = new NodeFileSystem()) {
    super();
    this.fileSystem = fs;
  }

  async setup(): Promise<void> {
    this.logger.info(`BaseStatic setup starting`, []);
    this.logger.info(`Base filesystem root: ${this.baseFsRoot}`, []);
    this.logger.info(`Config staticFsRoot: ${this.config.staticFsRoot}`, []);
    
    if (!this.baseFsRoot) {
      throw new BaseError("baseFsRoot dependency not injected - check DI configuration");
    }
  
    this.staticFsRoot = path.resolve(
      path.join(this.baseFsRoot, this.config.staticFsRoot),
    );
    
    this.logger.info(`Static file root: ${this.staticFsRoot}`);
    this.logger.info(`Max age setting: ${this.config.maxAge}`, []);
    this.logger.info(`BaseStatic setup complete`, []);
  }

  @request({ topic: "/get/static/:path*" , phase: 10 })
  async handleStatic({ context: ctx, path: reqPath }: BaseHttpActionArgs & { path?: string }) {
    if (!reqPath) {
      this.logger.debug(`No path provided, returning 400`, [ctx.id]);
      ctx.res.statusCode(400);
      void ctx.res.send("Bad request");
      return;
    }
    
    this.logger.debug(`Static request started for path: ${reqPath}`, [ctx.id]);
    
    const cleanPath = this.cleanPath(reqPath).join("/");
    this.logger.debug(`Cleaned path: ${cleanPath}`, [ctx.id]);

    if (!cleanPath) {
      this.logger.debug(`Empty path after cleaning, returning 400`, [ctx.id]);
      ctx.res.statusCode(400);
      void ctx.res.send("Bad request");
      return;
    }

    const filePath = path.join(path.resolve(this.staticFsRoot, cleanPath));
    this.logger.debug(`Resolved file path: ${filePath} from req path: ${reqPath}`, [ctx.id]);

    // Security check - ensure file is within static root
    if (!filePath.startsWith(this.staticFsRoot)) {      
      this.logger.warn(`Filepath(${filePath}) is outside of root(${this.staticFsRoot})`, [ctx.id]);
      ctx.res.statusCode(403);
      void ctx.res.send("Forbidden");
      return;
    }
    else {
      this.logger.debug(`Filepath(${filePath}) is inside of root(${this.staticFsRoot})`, [ctx.id]);
    }

    this.logger.debug(`Security check passed, loading file Filepath(${filePath})`, [ctx.id]);

    // Load the file
    let data: Buffer | string;
    let stats: fs.Stats;
    
    try {
      this.logger.debug(`Attempting to load file: ${filePath}`, [ctx.id], {FS: this.fileSystem});
      const result = await loadFile(filePath, this.fileSystem);
      data = result.data;
      stats = result.stats;
      this.logger.debug(`File loaded successfully, size: ${stats.size} bytes`, [ctx.id]);
    } catch (err) {
      const error = err as NodeError;
      this.logger.debug(`File load error: ${error.message} (code: ${error.code})`, [ctx.id]);
      if (error.message === "NOT FOUND" || error.code === "ENOENT") {
        this.logger.info(`Filepath(${filePath}) not found`, [ctx.id]);
        ctx.res.statusCode(404);
        void ctx.res.send("Not found");
        return;
      } else {
        this.logger.debug(`Unexpected file load error, throwing BaseError`, [ctx.id]);
        throw new BaseError(error);
      }
    }

    this.logger.debug(`Proceeding to send file`, [ctx.id]);
    // Handle caching and send file
    await this.sendFile(ctx, filePath, data, stats);
  }

  private async sendFile(
    ctx: BaseHttpActionArgs["context"],
    filePath: string,
    data: Buffer | string,
    stats: fs.Stats
  ): Promise<void> {
    this.logger.debug(`sendFile started for ${filePath}`, [ctx.id]);
    
    // Generate ETag
    const hash = crypto.createHash("sha1");
    hash.update(typeof data === "string" ? data : new Uint8Array(data));
    const etag = hash.digest("hex");
    this.logger.debug(`Generated ETag: ${etag}`, [ctx.id]);

    // Check If-None-Match header (ETag)
    const clientEtag = ctx.req.header("if-none-match");
    this.logger.debug(`Client ETag: ${clientEtag ?? "none"}`, [ctx.id]);
    
    if (clientEtag === etag) {
      this.logger.debug(`ETag match, returning 304 Not Modified`, [ctx.id]);
      ctx.res.statusCode(304);
      void ctx.res.send("Not Modified");
      return;
    }

    // Check If-Modified-Since header
    const modifiedSince = ctx.req.header("if-modified-since");
    this.logger.debug(`Client If-Modified-Since: ${modifiedSince ?? "none"}`, [ctx.id]);
    this.logger.debug(`File last modified: ${stats.mtime.toUTCString()}`, [ctx.id]);
    
    if (
      modifiedSince &&
      new Date(modifiedSince).getTime() >= stats.mtime.getTime()
    ) {
      this.logger.debug(`File not modified since ${modifiedSince}, returning 304`, [ctx.id]);
      ctx.res.statusCode(304);
      void ctx.res.send("Not Modified");
      return;
    }

    // Set headers and send file
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    this.logger.debug(`MIME type resolved: ${mimeType}`, [ctx.id]);
    this.logger.debug(`Setting cache max-age: ${this.config.maxAge}`, [ctx.id]);
    
    ctx.res.header("ETag", etag);
    ctx.res.header("Last-Modified", stats.mtime.toUTCString());
    ctx.res.header("Cache-Control", `public, max-age=${this.config.maxAge}`);
    
    this.logger.debug(`Sending file data, size: ${typeof data === "string" ? data.length : data.length} bytes`, [ctx.id]);
    void ctx.res.send(data, mimeType);
    
    this.logger.debug(`File served successfully: ${filePath}`, [ctx.id]);
  }

  private cleanPath(path: string): string[] {
    this.logger.debug(`cleanPath input: ${JSON.stringify(path)}`, []);
    
    if (!path.trim()) return [];
    
    const result = path
      .trim()
      .split("/")
      .filter((s: string) => !!s);
      
    this.logger.debug(`cleanPath result: ${JSON.stringify(result)}`, []);
    return result;
  }
}
