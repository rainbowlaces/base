import type * as http from "http";
import { registerDi } from "../di/decorators/registerDi";
import { BaseContext } from "../module/baseContext";
import { type HttpContextData } from "./types";
import { BaseRequest } from "./baseRequest";
import { BaseResponse } from "./baseResponse";

@registerDi()
export class BaseHttpContext extends BaseContext<HttpContextData> {
  #req: BaseRequest;
  #res: BaseResponse;
  #topic: string;

  constructor(req: http.IncomingMessage, res: http.ServerResponse) {
    super(
      (id: string, module: string, action: string, status: string) =>
        `/request/${id}/${module}/${action}/${status}`,
    );

    this.#req = new BaseRequest(this.id, req);
    this.#res = new BaseResponse(this.id, res);

    this.#topic = `/request/${this.id}/${this.#req.method}${this.#req.cleanPath}`;

    this.#res.on("done", () => {
      this.done();
    });

    this.#res.on("error", () => {
      this.error();
    });

    // Trigger RFA coordination flow
    void this._coordinateAndRun().catch((error: unknown) => {
      console.error("HTTP context coordination failed:", error);
      // For HTTP contexts, respond with 404 or 501
      if (!this.#res.headersSent) {
        this.#res.statusCode(404);
        void this.#res.send("Not Found");
      }
      this.error();
    });
  }

  protected getContextType(): string {
    return "http";
  }

  get topic(): string {
    return this.#topic;
  }

  get req() {
    return this.#req;
  }

  get res() {
    return this.#res;
  }
}
