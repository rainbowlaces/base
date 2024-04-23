import BaseContext from "../baseContext";
import BaseRequest from "./baseRequest";
import BaseResponse from "./baseResponse";
import * as http from "http";

type HttpContextData = Record<string, unknown>;

export class BaseHttpContext extends BaseContext<HttpContextData> {
  private _req: BaseRequest;
  private _res: BaseResponse;
  private _topic: string;

  constructor(req: http.IncomingMessage, res: http.ServerResponse) {
    super(
      (id: string, module: string, action: string, status: string) =>
        `/request/${id}/${module}/${action}/${status}`,
    );

    this._req = new BaseRequest(this.id, req);
    this._res = new BaseResponse(this.id, res);

    this._topic = `/request/${this.id}/${this._req.method}${this._req.cleanPath}`;

    this._res.on("done", () => {
      this.done();
    });

    this._res.on("error", () => {
      this.error();
    });
  }

  get topic(): string {
    return this._topic;
  }

  get req() {
    return this._req;
  }

  get res() {
    return this._res;
  }
}
