import { BaseContext } from "../baseContext";
import { BaseRequest } from "./baseRequest";
import { BaseResponse } from "./baseResponse";
import type * as http from "http";
import { registerDi } from "../di/decorators/registerDi";

type HttpContextData = Record<string, unknown>;

@registerDi()
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

    // Trigger RFA coordination flow
    void this._coordinateAndRun().catch((error: unknown) => {
      console.error("HTTP context coordination failed:", error);
      // For HTTP contexts, respond with 404 or 501
      if (!this._res.headersSent) {
        this._res.statusCode(404);
        void this._res.send("Not Found");
      }
      this.error();
    });
  }

  protected getContextType(): string {
    return "http";
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
