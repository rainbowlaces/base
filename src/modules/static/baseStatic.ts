import path from "path";
import crypto from "crypto";
import type * as fs from "fs";
import mime from "mime-types";
import { baseModule } from "../../core/module/decorators/baseModule";
import { type BaseClassConfig } from "../../core/config/types";
import { BaseModule } from "../../core/module/baseModule";
import { di } from "../../core/di/baseDi";
import { BaseError } from "../../core/baseErrors";
import { loadFile } from "../../utils/file";
import { request } from "../../core/module/decorators/request";
import { type BaseHttpActionArgs } from "../../core/module/types";
import { NodeFileSystem, type FileSystem } from "../../utils/fileSystem";

interface NodeError extends Error {
  code?: string;
}

export interface BaseStaticConfig extends BaseClassConfig {
  staticFsRoot?: string;
  maxAge?: number; 
}

// Declaration merging to add the logger config to the global app config type.
declare module "../../core/config/types" {
  interface BaseAppConfig {
    BaseStatic?: BaseStaticConfig;
  }
}

@baseModule
export class BaseStatic extends BaseModule<BaseStaticConfig> {
  @di("fsRoot")
  accessor baseFsRoot!: string;
  staticFsRoot: string = "";

  fileSystem: FileSystem = new NodeFileSystem();

  async setup(): Promise<void> {
    this.logger.debug(`BaseStatic setup starting`, []);
    this.logger.debug(`Base filesystem root: ${this.baseFsRoot}`, []);
    this.logger.debug(`Config staticFsRoot: ${this.config.staticFsRoot ?? "/public"}`, []);
    
    this.staticFsRoot = path.normalize(
      path.join(this.baseFsRoot, this.config.staticFsRoot ?? "/public"),
    );
    
    this.logger.info(`Static file root: ${this.staticFsRoot}`);
    this.logger.debug(`Max age setting: ${this.config.maxAge ?? 3600}`, []);
    this.logger.debug(`BaseStatic setup complete`, []);
  }

  @request("/get/static/:path*")
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

    const filePath = path.normalize(path.join(this.staticFsRoot, cleanPath));
    this.logger.debug(`Resolved file path: ${filePath}`, [ctx.id]);

    // Security check - ensure file is within static root
    if (!filePath.startsWith(this.staticFsRoot)) {
      this.logger.warn(`Filepath(${filePath}) is outside of root(${this.staticFsRoot})`, [ctx.id]);
      this.logger.debug(`Security check failed, returning 403`, [ctx.id]);
      ctx.res.statusCode(403);
      void ctx.res.send("Forbidden");
      return;
    }

    this.logger.debug(`Security check passed, loading file`, [ctx.id]);

    // Load the file
    let data: Buffer | string;
    let stats: fs.Stats;
    
    try {
      this.logger.debug(`Attempting to load file: ${filePath}`, [ctx.id]);
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
    this.logger.debug(`Setting cache max-age: ${this.config.maxAge ?? 3600}`, [ctx.id]);
    
    ctx.res.header("ETag", etag);
    ctx.res.header("Last-Modified", stats.mtime.toUTCString());
    ctx.res.header("Cache-Control", `public, max-age=${this.config.maxAge ?? 3600}`);
    
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
