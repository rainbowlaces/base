import { init } from "../../decorators/actions/init";
import { BaseModule } from "../../core/baseModule";
import { di } from "../../core/di/decorators/di";
import path from "path";
import { loadFile } from "../../utils/file";
import { request } from "../../decorators/actions/request";
import { baseModule } from "../../decorators/baseModule";
import { type BaseHttpActionArgs } from "../../core/baseAction";
import { dependsOn } from "../../decorators/dependsOn";
import { BaseError } from "../../core/baseErrors";

import crypto from "crypto";

import type * as fs from "fs";
import mime from "mime-types";

interface NodeError extends Error {
  code?: string;
}

@baseModule
export class BaseStatic extends BaseModule {
  @di("fsRoot")
  accessor baseFsRoot!: string;

  // TODO: These will be configured via typed config system
  staticFsRoot = "/public";
  maxAge = 3600;

  @init()
  async init() {
    this.staticFsRoot = path.normalize(
      path.join(this.baseFsRoot, this.staticFsRoot),
    );
    this.logger.info(`Static file root: ${this.staticFsRoot}`);
  }

  @request("/get/static/:path*")
  async handleStatic(args: BaseHttpActionArgs) {
    const ctx = args.context;
    const cleanPath = this.cleanPath(args.path as string | string[]).join("/");

    if (!cleanPath) return;

    ctx.data.filePath = path.normalize(path.join(this.staticFsRoot, cleanPath));
    ctx.data.root = this.staticFsRoot;
    ctx.data.fileRequest = true;

    return;
  }

  @dependsOn("handleStatic")
  @request("/get/static/:path*")
  async handleStaticFile(args: BaseHttpActionArgs) {
    return this.handleFile(args);
  }

  private async handleFile(args: BaseHttpActionArgs) {
    const ctx = args.context;

    const filePath = (ctx.data.filePath as string) || "";
    const root = (ctx.data.root as string) || "";

    if (!ctx.data.fileRequest || !filePath || !root) {
      ctx.res.statusCode(400);
      void ctx.res.send("Bad request");
      return;
    }

    if (!filePath.startsWith(root)) {
      this.logger.warn(`Filepath(${filePath}) is outside of root(${root})`, [
        ctx.id,
      ]);
      ctx.res.statusCode(403);
      void ctx.res.send("Forbidden");
      return;
    }

    try {
      const { data, stats } = await loadFile(filePath);
      ctx.data.data = data;
      ctx.data.stats = stats;
    } catch (err) {
      const error = err as NodeError;
      if (error.message === "NOT FOUND" || error.code === "ENOENT") {
        this.logger.info(`Filepath(${filePath}) not found`, [ctx.id]);
        ctx.res.statusCode(404);
        void ctx.res.send("Not found");
        return;
      } else {
        throw new BaseError(error);
      }
    }
    return;
  }

  @dependsOn("handleStaticFile")
  @request("/get/static/:path*")
  async sendStaticFile(args: BaseHttpActionArgs) {
    return this.sendFile(args);
  }

  async sendFile(args: BaseHttpActionArgs) {
    const ctx = args.context;
    if (!ctx.data.fileRequest) return;

    const filePath = ctx.data.filePath as string;
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
      void ctx.res.send("Not Modified");
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
      void ctx.res.send("Not Modified");
      return;
    }

    const mimeType = mime.lookup(filePath) || "application/octet-stream";

    ctx.res.header("ETag", etag);
    ctx.res.header("Last-Modified", stats.mtime.toUTCString());
    ctx.res.header("Cache-Control", `public, max-age=${this.maxAge}`);
    void ctx.res.send(data, mimeType);
    this.logger.debug(`Filepath(${filePath}) served`, [ctx.id]);
    return;
  }

  private cleanPath(path: string | string[]): string[] {
    if (Array.isArray(path)) path = path.join("/");
    if (typeof path !== "string") return [];
    if (!path.trim()) return [];
    return path
      .trim()
      .split("/")
      .filter((s: string) => !!s);
  }
}
