import http from "http";
import { type BaseLogger } from "../logger/baseLogger";
import { registerDi } from "../di/decorators/registerDi";
import { di } from "../di/decorators/di";
import { type BasePubSub } from "../pubsub/basePubSub";
import { delay } from "../../utils/async";
import { type BaseError } from "../baseErrors";
import { type BaseRouter } from "./baseRouter";
import { BaseHttpContext } from "./httpContext";
import { type BaseRequestHandlerConfig } from "./types";
import { config } from "../config/decorators/config";

@registerDi({setup: true, singleton: true, teardown: true, phase: 100})
export class BaseRequestHandler {
  #server!: http.Server;

  @di<BaseLogger>("BaseLogger", "RequestHandler")
  private accessor logger!: BaseLogger;

  @config<BaseRequestHandlerConfig>("RequestHandler")
  private accessor config!: BaseRequestHandlerConfig;

  @di<BasePubSub>("BasePubSub")
  private accessor bus!: BasePubSub;

  @di<BaseRouter>("BaseRouter")
  private accessor router!: BaseRouter;

  constructor() {
    this.#server = http.createServer((req, res) => void this.handleRequest(req, res));
  }

  async setup() {
    const port = this.config.port ?? 3000;
    this.#server.listen(port, () => {
      this.logger.info(`Server listening on port ${port}`);
    });
  }

  async teardown() {
    this.#server.closeAllConnections();
  }

  private async handleContext(ctx: BaseHttpContext) {
    ctx.res.once("done", () => {
      this.logger.info("Request done.", [ctx.id]);
      ctx.res.removeAllListeners("error");
    });

    ctx.res.once("error", (err: BaseError) => {
      this.logger.warn(err.message, [ctx.id], { err });
      ctx.res.removeAllListeners("done");
    });

    this.logger.info(`New request: ${ctx.topic}`, [ctx.id]);

    void this.bus.pub(ctx.topic, { context: ctx });

    await delay(this.config.requestTimeout ?? 5000);

    if (ctx.res.finished) return;

    this.logger.warn("Request timed out.", [ctx.id]);
    ctx.res.statusCode(408);
    void ctx.res.send("Request timed out.");
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    const _url = new URL(req.url ?? "", `http://example.com`);
    const rw = this.router.handleRoute(_url.pathname);

    if (rw.rewrite) {
      this.logger.debug(`Rewriting ${rw.original || "/"} >> ${rw.target}`);
      req.url = rw.target + _url.search;
    }

    const ctx = new BaseHttpContext(req, res);
    return this.handleContext(ctx);
  }
}
