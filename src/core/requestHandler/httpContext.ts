import type * as http from "http";
import { registerDi } from "../di/decorators/registerDi.js";
import { BaseContext } from "../module/baseContext.js";
import { type HttpContextData } from "./types.js";
import { BaseRequest } from "./baseRequest.js";
import { BaseResponse } from "./baseResponse.js";

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

    void this.coordinateAndRun(this.#topic).catch((error: unknown) => {
      if (error instanceof Error && error.message.includes("No handlers were found for topic")) {
        this.logger.debug("Returning 404 for unhandled route:", [], { error });
      } else {
        this.logger.error("HTTP context coordination failed:", [], { error });
      }
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
