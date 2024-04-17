import * as http from "http";
import BaseError from "./baseErrors";
import BaseContext from "./baseContext";
import { Readable } from "stream";
import di from "../decorators/di";
import BaseConfig from "./config";
import BaseLogger from "./logger";
import { EventEmitter } from "events";

export default class BaseResponse extends EventEmitter {
  private _ctx: BaseContext;
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

  constructor(ctx: BaseContext, res: http.ServerResponse) {
    super();

    this._res = res;
    this._ctx = ctx;

    this._res.on("finish", () => {
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
    this.emit("redirect", url);
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
    if (!value) return this._headers[name];
    if (this._headersSent) throw new BaseError("Headers already sent.");
    this._headers[name] = value;
  }

  private ensureHeadersSent() {
    if (!this._headersSent) {
      if (this._statusMessage)
        this.rawResponse.statusMessage = this._statusMessage;
      this.rawResponse.writeHead(this._statusCode, this._headers);
      this._headersSent = true;
    }
  }

  private end(data?: string | Buffer) {
    if (this._finished) return;
    this.rawResponse.end(data);
    this._finished = true;
    this.emit("done");
  }

  send(data: string | Buffer | Readable) {
    this.ensureHeadersSent();
    if (data instanceof Buffer || typeof data === "string")
      return this.end(data);
    data.pipe(this.rawResponse);
    data.on("end", () => this.end());
    return;
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
