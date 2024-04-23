import * as http from "http";
import BaseError from "../baseErrors";
import { Readable } from "stream";
import di from "../../decorators/di";
import BaseConfig from "../config";
import BaseLogger from "../logger";
import { EventEmitter } from "events";

import cookie from "cookie";
import signature from "cookie-signature";

interface CookieOptions {
  expires?: Date;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
}

export default class BaseResponse extends EventEmitter {
  private _res: http.ServerResponse;

  private _statusCode: number = 200;
  private _statusMessage?: string;

  private _headersSent: boolean = false;
  private _finished: boolean = false;

  private _headers: http.OutgoingHttpHeaders = {};

  @di("BaseLogger", "base_response")
  private _logger!: BaseLogger;

  @di("BaseConfig", "request_handler")
  private _config!: BaseConfig;

  private _ctxId: string;

  get headersSent(): boolean {
    return this._res.headersSent || this._headersSent;
  }

  constructor(ctxId: string, res: http.ServerResponse) {
    super();
    this._ctxId = ctxId;

    this._res = res;

    this._res.on("finish", () => {
      if (this._finished) return;
      this.end();
    });

    this._res.on("close", () => {
      if (this._finished) return;
      this._finished = true;
      this.emit(
        "error",
        new BaseError("Client closed before response was finished."),
      );
    });
  }

  redirect(url: string) {
    if (this._finished) return;
    this._logger.info(`Redirecting to ${url}`, [this._ctxId]);
    this.statusCode(302);
    this.header("location", url);
    this.ensureHeadersSent();
    this.end();
  }

  statusCode(): number;
  statusCode(code: number): void;
  statusCode(code?: number): void | number {
    if (code === undefined) return this._statusCode;
    this._statusCode = code ?? this._statusCode;
  }

  statusMessage(): string;
  statusMessage(message: string): void;
  statusMessage(message?: string): void | string {
    if (message === undefined) return this._statusMessage;
    this._statusMessage = message;
  }

  header(name: string): http.OutgoingHttpHeader;
  header(name: string, value: http.OutgoingHttpHeader): void;
  header(
    name: string,
    value?: http.OutgoingHttpHeader,
  ): void | http.OutgoingHttpHeader {
    if (!value) return this._headers[name.toLowerCase()];
    if (this.headersSent)
      this._logger.warn(`Headers already sent when setting header ${name}.`, [
        this._ctxId,
      ]);
    this._headers[name.toLowerCase()] = value;
  }

  cookie(name: string, value: string, options: CookieOptions = {}) {
    const secret = this._config.get<string>("cookieSecret", "");
    let finalValue = value;

    if (secret) {
      finalValue = "s:" + signature.sign(finalValue, secret);
    }

    const cookieOptions: cookie.CookieSerializeOptions = {
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
      if (this._statusMessage)
        this.rawResponse.statusMessage = this._statusMessage;
      this.rawResponse.writeHead(this._statusCode, this._headers);
      this._headersSent = true;
      return;
    }
  }

  private end(data?: string | Buffer) {
    if (this._finished) return;
    this.rawResponse.end(data);
    this._finished = true;
    this.emit("done");
  }

  async html(html: string) {
    return this.send(html, "text/html; charset=utf-8");
  }

  async json(data: object) {
    return this.send(JSON.stringify(data), "application/json; charset=utf-8");
  }

  async text(text: string) {
    return this.send(text, "text/plain; charset=utf-8");
  }

  async download(
    data: Readable,
    fileName: string,
    mimeType: string = "application/octet-stream",
  ) {
    this.header("content-disposition", `attachment; filename=${fileName}`);
    return this.send(data, mimeType);
  }

  async send(
    data: string | Buffer | Readable,
    mimeType: string = "text/plain; charset=utf-8",
  ) {
    this.header("content-type", mimeType);
    this.ensureHeadersSent();
    if (data instanceof Buffer || typeof data === "string")
      return this.end(data);
    return new Promise<void>((resolve) => {
      data.pipe(this.rawResponse);
      data.on("end", () => {
        this.end();
        resolve();
      });
    });
  }

  finish() {
    this._finished = true;
  }

  get rawResponse(): http.ServerResponse {
    return this._res;
  }

  get finished(): boolean {
    return this._finished;
  }
}
