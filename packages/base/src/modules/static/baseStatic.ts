import path from "path";
import type * as fs from "fs";
import mime from "mime-types";
import zlib from "zlib";
import { BaseClassConfig, type ConfigData } from "../../core/config/types.js";
import { configClass } from "../../core/config/decorators/provider.js";
import { BaseModule } from "../../core/module/baseModule.js";
import { di } from "../../core/di/baseDi.js";
import { BaseError } from "../../core/baseErrors.js";
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
  // Optional allowlist for dot-prefixed directories/files (e.g. ['.well-known'])
  dotfileAllowlist: string[] = [];
  // Cross-Origin-Resource-Policy value (configurable). Set to empty string to disable.
  crossOriginResourcePolicy: string = "same-origin";
  // Maximum allowed file size in bytes; files larger will not be served (protect misuse)
  maxFileSizeBytes: number = 3 * 1024 * 1024; // 3MB default
  // Enable on-the-fly compression
  enableCompression: boolean = true;
  // Minimum original size (bytes) before attempting compression
  compressionThreshold: number = 1024; // 1KB
  // Ordered preference for algorithms we can produce (subset negotiated with client Accept-Encoding)
  compressionAlgorithms: ("br"|"gzip")[] = ["br", "gzip"]; // deflate excluded on purpose
  // MIME type prefixes considered compressible
  compressibleMimePrefixes: string[] = ["text/"];
  // Exact MIME types considered compressible
  compressibleMimeTypes: string[] = [
    "application/json",
    "application/javascript",
    "application/xml",
    "image/svg+xml"
  ];
  // MIME prefixes never to compress (safety / efficiency)
  neverCompressMimePrefixes: string[] = [
    "image/",
    "audio/",
    "video/"
  ];
  // Exact MIME types never to compress
  neverCompressMimeTypes: string[] = [
    "application/zip",
    "application/pdf",
    "application/octet-stream"
  ];
  // Max total bytes for in-memory compression cache (0 disables caching)
  compressionCacheMaxBytes: number = 64 * 1024 * 1024; // 64MB
}

// Declaration merging to add the logger config to the global app config type.
declare module "../../core/config/types.js" {
  interface BaseAppConfig {
    BaseStatic?: ConfigData<BaseStaticConfig>;
  }
}

@registerDi({setup: true, singleton: true, phase: 30, tags: ["Module"]})
export class BaseStatic extends BaseModule<BaseStaticConfig> {
  @di("fsRoot")
  accessor baseFsRoot!: string;
  staticFsRoot: string = "";
  fileSystem: FileSystem;
  // Simple in-memory compression cache: key => { body, encoding, size }
  private compressionCache: Map<string, { body: Buffer; size: number }> = new Map();
  private compressionCacheBytes = 0;

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
  ctx.res.statusCode(404);
  void ctx.res.send("Not found");
      return;
    }
    
  this.logger.debug(`Static request started for path: ${reqPath}`, [ctx.id]);
    
    const cleanPath = this.cleanPath(reqPath).join("/");
    this.logger.debug(`Cleaned path: ${cleanPath}`, [ctx.id]);

    if (!cleanPath) {
      this.logger.debug(`Empty path after cleaning, returning 400`, [ctx.id]);
  ctx.res.statusCode(404);
  void ctx.res.send("Not found");
      return;
    }

    const filePath = path.resolve(this.staticFsRoot, cleanPath);
    this.logger.debug(`Resolved file path: ${filePath} from req path: ${reqPath}`, [ctx.id]);

    // Security check - ensure file is within static root
    const rel = path.relative(this.staticFsRoot, filePath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      this.logger.warn(`Path traversal attempt or outside root: requested=${reqPath} resolved=${filePath}`, [ctx.id]);
  ctx.res.statusCode(404);
  void ctx.res.send("Not found");
      return;
    }
    else {
      this.logger.debug(`Filepath(${filePath}) is inside of root(${this.staticFsRoot})`, [ctx.id]);
    }

    // Disallow hidden files / dotfiles (common leakage vector)
    if (cleanPath.split("/").some(seg => seg.startsWith("."))) {
      const segments = cleanPath.split("/");
      const blocked = segments.filter(seg => seg.startsWith(".") && !this.config.dotfileAllowlist.includes(seg));
      if (blocked.length > 0) {
        this.logger.warn(`Dotfile access blocked (segments=${blocked.join(",")}): ${filePath}`, [ctx.id]);
        ctx.res.statusCode(404);
        void ctx.res.send("Not found");
        return;
      }
    }

    this.logger.debug(`Security check passed, loading file Filepath(${filePath})`, [ctx.id]);

    // Load the file (atomic open+stat+read) unless HEAD (optimize)
  let data: Buffer | undefined;
  let stats: fs.Stats;
    
    try {
      this.logger.debug(`Attempting to load file: ${filePath}`, [ctx.id], {FS: this.fileSystem});
      const method = ctx.req.method;
      if (method === 'head') {
        stats = await this.fileSystem.stat(filePath); // HEAD optimization: don't read data
        this.logger.debug(`HEAD stat only size=${stats.size} bytes for ${filePath}`, [ctx.id]);
      } else {
        const result = await this.fileSystem.openStatRead(filePath);
        stats = result.stats;
        data = result.data;
        this.logger.debug(`Atomic open+stat+read size=${stats.size} bytes`, [ctx.id]);
      }

      if (typeof stats.isDirectory === 'function' && stats.isDirectory()) {
        this.logger.warn(`Directory request blocked (pre-read): ${filePath}`, [ctx.id]);
        ctx.res.statusCode(404);
        void ctx.res.send("Not found");
        return;
      }

  if (stats.size > this.config.maxFileSizeBytes) {
        this.logger.warn(`File size ${stats.size} exceeds limit ${this.config.maxFileSizeBytes} - refusing ${filePath}`, [ctx.id]);
        ctx.res.statusCode(404);
        void ctx.res.send("Not found");
        return;
      }

      // Realpath & symlink escape check before reading
      try {
        const realPre = await this.fileSystem.realpath(filePath);
        const realRelPre = path.relative(this.staticFsRoot, realPre);
        if (realRelPre.startsWith('..') || path.isAbsolute(realRelPre)) {
          this.logger.warn(`Symlink escape blocked pre-read: requested=${filePath} real=${realPre}`, [ctx.id]);
          ctx.res.statusCode(404);
          void ctx.res.send("Not found");
          return;
        }
      } catch (rpErr) {
        this.logger.debug(`realpath (pre-read) failed (${(rpErr as Error).message}) for ${filePath}; continuing`, [ctx.id]);
      }

      if (data) {
        this.logger.debug(`File loaded successfully size: ${stats.size} bytes`, [ctx.id]);
      }

      // Directory check moved earlier before read; keep here for belt & braces
      if (typeof stats.isDirectory === 'function' && stats.isDirectory()) {
        this.logger.warn(`Directory request blocked (late): ${filePath}`, [ctx.id]);
        ctx.res.statusCode(404);
        void ctx.res.send("Not found");
        return;
      }
    } catch (err) {
      const error = err as NodeError;
      this.logger.debug(`File load error: ${error.message} (code: ${error.code})`, [ctx.id]);
      if (error.message === "NOT FOUND" || error.code === "ENOENT") {
        this.logger.info(`Filepath(${filePath}) not found`, [ctx.id]);
        ctx.res.statusCode(404);
        void ctx.res.send("Not found");
        return;
      } else {
  // Collapse unexpected errors to 404 to reduce probing signal
  this.logger.warn(`Unexpected file load error collapsed to 404 (code: ${error.code ?? 'unknown'}) serving ${filePath}`, [ctx.id]);
  ctx.res.statusCode(404);
  void ctx.res.send("Not found");
  return;
      }
    }

    this.logger.debug(`Proceeding to send file`, [ctx.id]);
    // Handle caching and send file
  await this.sendFile(ctx, filePath, data, stats);
  }

  private async sendFile(
    ctx: BaseHttpActionArgs["context"],
    filePath: string,
  data: Buffer | undefined,
    stats: fs.Stats
  ): Promise<void> {
    this.logger.debug(`sendFile started for ${filePath}`, [ctx.id]);
    
  // Weak ETag (size-mtime)
  const etag = `W/"${stats.size}-${stats.mtime.getTime()}"`;
    this.logger.debug(`Generated ETag: ${etag}`, [ctx.id]);

    // Check If-None-Match header (ETag)
    const clientEtag = ctx.req.header("if-none-match");
    this.logger.debug(`Client ETag: ${clientEtag ?? "none"}`, [ctx.id]);
    
  if (clientEtag === etag) {
      this.logger.debug(`ETag match, returning 304 Not Modified`, [ctx.id]);
      ctx.res.statusCode(304);
      // No body needed for 304
      void ctx.res.send("");
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
      void ctx.res.send("");
      return;
    }

  // Set headers and send file
  const mimeType = mime.lookup(filePath) || "application/octet-stream";
    this.logger.debug(`MIME type resolved: ${mimeType}`, [ctx.id]);
    this.logger.debug(`Setting cache max-age: ${this.config.maxAge}`, [ctx.id]);
    
    ctx.res.header("ETag", etag);
    ctx.res.header("Last-Modified", stats.mtime.toUTCString());
    ctx.res.header("Cache-Control", `public, max-age=${this.config.maxAge}`);
    ctx.res.header("X-Content-Type-Options", "nosniff");
    ctx.res.header("Referrer-Policy", "no-referrer");
    if (this.config.crossOriginResourcePolicy) {
      ctx.res.header("Cross-Origin-Resource-Policy", this.config.crossOriginResourcePolicy);
    }
    
    let body: Buffer | undefined = data; // may be undefined for HEAD
    const originalSize = body ? body.length : stats.size;
  const method = ctx.req.method; // already normalized

    // Always set Vary if compression enabled (even if we don't compress this one)
    if (this.config.enableCompression) {
      ctx.res.header('Vary', 'Accept-Encoding');
    }

    // Decide on compression (only for non-HEAD, compressible mime, size threshold, enabled)
  if (method !== 'head' && body && this.config.enableCompression && originalSize >= this.config.compressionThreshold) {
      const aeRaw = ctx.req.header('accept-encoding') || '';
      const tokens = aeRaw.split(',').map(v => v.trim()).filter(Boolean);
      // Parse q-values
      const encPrefs: { enc: string; q: number; order: number }[] = [];
      tokens.forEach((tok, idx) => {
        const [encPart, ...params] = tok.split(';').map(s => s.trim());
        let q = 1;
        for (const p of params) {
          const [k,v] = p.split('=');
          if (k === 'q') {
            const num = parseFloat(v);
            if (!Number.isNaN(num)) q = num;
          }
        }
        encPrefs.push({ enc: encPart, q, order: idx });
      });
      encPrefs.sort((a,b)=> b.q - a.q || a.order - b.order);
      const canCompress = (mt: string) => {
        if (this.config.neverCompressMimeTypes.includes(mt)) return false;
        if (this.config.neverCompressMimePrefixes.some(p => mt.startsWith(p))) return false;
        if (this.config.compressibleMimeTypes.includes(mt)) return true;
        if (this.config.compressibleMimePrefixes.some(p => mt.startsWith(p))) return true;
        return false;
      };
  const forbiddenEncodings = new Set(encPrefs.filter(p => p.q === 0).map(p => p.enc));
  const identityForbidden = forbiddenEncodings.has('identity');
      if (!canCompress(mimeType) && identityForbidden) {
        // Client refuses identity and we cannot compress -> 406
        this.logger.debug(`No acceptable encoding available (identity forbidden, mime not compressible). Returning 406.`, [ctx.id]);
        ctx.res.statusCode(406);
        void ctx.res.send("");
        return;
      }
      if (canCompress(mimeType)) {
        const serverOrder = this.config.compressionAlgorithms;
        // map preferences to available
        let chosen: 'br' | 'gzip' | undefined;
        for (const pref of encPrefs) {
          if (pref.q === 0) continue; // explicitly banned
          if (pref.enc === '*') {
            // pick first server algorithm not explicitly forbidden
            const fallbackEnc = serverOrder.find(a => !forbiddenEncodings.has(a));
            if (fallbackEnc === 'br' || fallbackEnc === 'gzip') chosen = fallbackEnc;
            break;
          }
          if (pref.enc === 'br' && serverOrder.includes('br') && !forbiddenEncodings.has('br')) { chosen = 'br'; break; }
          if (pref.enc === 'gzip' && serverOrder.includes('gzip') && !forbiddenEncodings.has('gzip')) { chosen = 'gzip'; break; }
        }
        if (!chosen) {
            // fallback: first available not forbidden
            const finalEnc = serverOrder.find(a => !forbiddenEncodings.has(a));
            if (finalEnc === 'br' || finalEnc === 'gzip') chosen = finalEnc;
        }
        if (chosen) {
          // Precompressed support
          const precompressedPath = `${filePath}.${chosen === 'br' ? 'br' : 'gz'}`;
          let usedPrecompressed = false;
          if (await this.fileSystem.exists(precompressedPath)) {
            try {
              body = await this.fileSystem.readFile(precompressedPath);
              usedPrecompressed = true;
              this.logger.debug(`Served precompressed file ${precompressedPath}`, [ctx.id]);
            } catch {
              // fallback to dynamic
            }
          }
          if (!usedPrecompressed) {
            // Cache key uses etag+encoding
            const cacheKey = `${etag}:${chosen}`;
            const cached = this.compressionCache.get(cacheKey);
            if (cached) {
              body = cached.body;
              this.logger.debug(`Compression cache hit ${cacheKey}`, [ctx.id]);
            } else {
              try {
                this.logger.debug(`Compressing (${chosen}) orig ${originalSize} bytes`, [ctx.id]);
                if (chosen === 'br') {
                  body = await new Promise<Buffer>((resolve, reject) => zlib.brotliCompress(body as Buffer, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }, (e,r)=> e?reject(e):resolve(r)));
                } else {
                  body = await new Promise<Buffer>((resolve, reject) => zlib.gzip(body as Buffer, { level: 6 }, (e,r)=> e?reject(e):resolve(r)));
                }
                this.addToCompressionCache(cacheKey, body);
                this.logger.debug(`Compression ${chosen} done => ${body.length} bytes`, [ctx.id]);
              } catch (cErr) {
                this.logger.warn(`Compression failed (${(cErr as Error).message}); sending uncompressed`, [ctx.id]);
              }
            }
          }
          if (body) {
            ctx.res.header('Content-Encoding', chosen);
          }
        }
      }
    }

    const sendSize = body ? body.length : 0;
    this.logger.debug(`Sending file data, size: ${sendSize} bytes`, [ctx.id]);
    if (method === 'head') {
      void ctx.res.send("", mimeType);
    } else {
      void ctx.res.send(body ?? Buffer.alloc(0), mimeType);
    }
    
    this.logger.debug(`File served successfully: ${filePath}`, [ctx.id]);
  }

  private addToCompressionCache(key: string, buf: Buffer): void {
    const size = buf.length;
  const maxBytes = this.config.compressionCacheMaxBytes;
  if (maxBytes <= 0) return; // caching disabled
  if (size > maxBytes) {
      // Too big to cache at all
      return;
    }
    // Evict oldest entries until we have room
  while (this.compressionCacheBytes + size > maxBytes && this.compressionCache.size > 0) {
  const oldestKey = this.compressionCache.keys().next().value; // inferred as string | undefined
      if (!oldestKey) break;
      const oldest = this.compressionCache.get(oldestKey);
      if (oldest) {
        this.compressionCacheBytes -= oldest.size;
      }
      this.compressionCache.delete(oldestKey);
    }
    this.compressionCache.set(key, { body: buf, size });
    this.compressionCacheBytes += size;
  }

  private cleanPath(raw: string): string[] {
    this.logger.debug(`cleanPath input: ${JSON.stringify(raw)}`, []);
    if (!raw.trim()) return [];
    const segments: string[] = [];
    for (const seg of raw.trim().split("/")) {
      if (!seg) continue;
      let decoded: string;
      try {
        decoded = decodeURIComponent(seg);
      } catch {
        this.logger.warn(`Percent-decoding failed for segment: ${seg}`, []);
        return []; // Force failure => 400 earlier
      }
      // Unicode normalization (NFC) to prevent alternate representations
      const normalized = decoded.normalize('NFC');
      if (normalized !== decoded) {
        this.logger.debug(`Normalized Unicode segment '${decoded}' -> '${normalized}'`, []);
      }
      decoded = normalized;
      if (/\0|[\p{Cc}\p{Cf}]/u.test(decoded)) {
        this.logger.warn(`Control/format char in path segment blocked`, []);
        return [];
      }
      if (decoded === "." || decoded === "..") {
        this.logger.warn(`Dot or dotdot segment blocked`, []);
        return [];
      }
      segments.push(decoded);
    }
    this.logger.debug(`cleanPath result: ${JSON.stringify(segments)}`, []);
    return segments;
  }
}
