import type * as http from "http";
import { type Readable } from "stream";
import { registerDi } from "../../core/di/decorators/registerDi.js";
import { di } from "../../core/di/decorators/di.js";
import { BaseLogger } from "../../core/logger/baseLogger.js";
import { EventEmitter } from "events";

import cookie from "cookie";
import signature from "cookie-signature";
import {  type CookieOptions } from "./types.js";
import { config } from "../config/decorators/config.js";
import { type MaybeAsync } from "../types.js";
import { type BaseRequestHandlerConfig } from "./baseRequestHandler.js";

@registerDi()
export class BaseResponse extends EventEmitter {
  #res: http.ServerResponse;

  #statusCode = 200;
  #statusMessage?: string;

  #headersSent = false;
  #finished = false;

  #headers: http.OutgoingHttpHeaders = {};

  @di(BaseLogger, "BaseResponse")
  private accessor logger!: BaseLogger;

  @config('BaseRequestHandler')
  private accessor config!: BaseRequestHandlerConfig;

  #ctxId: string;

  get headersSent(): boolean {
    return this.#res.headersSent || this.#headersSent;
  }

  constructor(ctxId: string, res: http.ServerResponse) {
    super();
    this.#ctxId = ctxId;

    this.#res = res;

    this.#res.on("finish", () => {
      if (this.#finished) return;
      this.end();
    });

    this.#res.on("close", () => {
      if (this.#finished) return;
      this.#finished = true;
      this.emit("done");
    });
  }

  redirect(url: string) {
    if (this.#finished) return;
    this.logger.debug(`Redirecting to ${url}`, [this.#ctxId]);
    this.statusCode(302);
    this.header("location", url);
    this.ensureHeadersSent();
    this.end();
  }

  statusCode(): number;
  statusCode(code: number): void;
  statusCode(code?: number): void | number {
    if (code === undefined) return this.#statusCode;
    this.#statusCode = code;
  }

  statusMessage(): string;
  statusMessage(message: string): void;
  statusMessage(message?: string): void | string {
    if (message === undefined) return this.#statusMessage;
    this.#statusMessage = message;
  }

  header(name: string): http.OutgoingHttpHeader;
  header(name: string, value: http.OutgoingHttpHeader): void;
  header(
    name: string,
    value?: http.OutgoingHttpHeader,
  ): void | http.OutgoingHttpHeader {
    if (!value) return this.#headers[name.toLowerCase()];
    if (this.headersSent)
      this.logger.warn(`Headers already sent when setting header ${name}.`, [
        this.#ctxId,
      ]);
    this.#headers[name.toLowerCase()] = value;
  }

  cookie(name: string, value: string, options: CookieOptions = {}) {
    const secret = this.config.cookieSecret;
    let finalValue = value;

    if (secret.length > 0) {
      finalValue = "s:" + signature.sign(finalValue, secret);
    }

    const cookieOptions: cookie.SerializeOptions = {
      ...options,
      httpOnly: options.httpOnly ?? true,
      secure: options.secure ?? false,
      sameSite: options.sameSite ?? "strict",
      path: "/",
    };

    const cookies = this.header("set-cookie");
    if (Array.isArray(cookies)) {
      this.header("set-cookie", [
        ...cookies,
        cookie.serialize(name, finalValue, cookieOptions),
      ]);
    } else {
      this.header(
        "set-cookie",
        cookie.serialize(name, finalValue, cookieOptions),
      );
    }
  }

  private ensureHeadersSent() {
    if (!this.headersSent) {
      if (this.#statusMessage)
        this.rawResponse.statusMessage = this.#statusMessage;
      this.rawResponse.writeHead(this.#statusCode, this.#headers);
      this.#headersSent = true;
      return;
    }
  }

  private end(data?: string | Buffer) {
    if (this.#finished) return;
    this.rawResponse.end(data);
    this.#finished = true;
    this.emit("done");
  }

  async html(html: MaybeAsync<string>) {
    return this.send(await html, "text/html; charset=utf-8");
  }

  async json(data: MaybeAsync<object>) {
    return this.send(JSON.stringify(await data), "application/json; charset=utf-8");
  }

  async text(text: MaybeAsync<string>) {
    return this.send(await text, "text/plain; charset=utf-8");
  }

  async download(
    data: MaybeAsync<Readable>,
    fileName: string,
    mimeType = "application/octet-stream",
  ) {
    this.header("content-disposition", `attachment; filename=${fileName}`);
    return this.send(await data, mimeType);
  }

  async  send(
    data: MaybeAsync<string | Buffer | Readable>,
    mimeType = "text/plain; charset=utf-8",
  ) {
    this.header("content-type", mimeType);
    this.ensureHeadersSent();
    data = await data;
    if (data instanceof Buffer || typeof data === "string")
      { this.end(data); return; }
    
    // At this point, data must be a Readable stream
    const stream = data as Readable;
    return new Promise<void>((resolve) => {
      stream.pipe(this.rawResponse);
      stream.on("end", () => {
        this.end();
        resolve();
      });
    });
  }

  finish() {
    this.#finished = true;
  }

  get rawResponse(): http.ServerResponse {
    return this.#res;
  }

  get finished(): boolean {
    return this.#finished;
  }

  /**
   * Extend/reset the request timeout countdown.
   * Emits an internal 'extend-timeout' event listened for by BaseRequestHandler.
   */
  extendTimeout(milliseconds: number): void {
    if (this.#finished) return;
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
    this.emit("extend-timeout", milliseconds);
  }
}
