import http from "http";
import BaseRequest from "./baseRequest";
import BaseResponse from "./baseResponse";
import { nanoid } from "nanoid";
import path from "path";
import EventEmitter from "events";
import { BaseTopicLogger } from "./baseReadyCheck";

export default class BaseContext extends EventEmitter {
  private _id: string;
  private _topic: string;
  private _req: BaseRequest;
  private _res: BaseResponse;
  private _created: number = Date.now();
  private _handled: boolean = false;

  private _data: Map<string, unknown> = new Map<string, unknown>();

  private _messageLog!: BaseTopicLogger;

  constructor(req: http.IncomingMessage, res: http.ServerResponse) {
    super();

    this._req = new BaseRequest(this, req);
    this._res = new BaseResponse(this, res);

    const cleanPath = path.posix
      .normalize(this._req.url.pathname)
      .replace(/^(\.\.\/|\.\/)+/, "");

    this._id = nanoid();
    this._topic = `/request/${this._req.method}${cleanPath}`;

    this._messageLog = new BaseTopicLogger(
      `/request/${this.id}/:module/:action`,
    );
  }

  get req(): BaseRequest {
    return this._req;
  }

  get res(): BaseResponse {
    return this._res;
  }

  get id(): string {
    return this._id;
  }

  get topic(): string {
    return this._topic;
  }

  get age(): number {
    return Date.now() - this._created;
  }

  get created(): number {
    return this._created;
  }

  get handled(): boolean {
    return this._handled;
  }

  public handle(): void {
    this._handled = true;
  }

  public set(key: string, value: unknown): void {
    this._data.set(key, value);
  }

  public get<T>(key: string): T | undefined {
    return this._data.get(key) as T;
  }

  public waitForActions(actions: string[]): Promise<void> {
    return this._messageLog.waitFor(
      actions.map((action) => `/request/${this.id}/${action}`),
    );
  }
}
