import http from "http";
import { type BaseLogger } from "../logger/baseLogger.js";
import { registerDi } from "../di/decorators/registerDi.js";
import { di } from "../di/decorators/di.js";
import { type BasePubSub } from "../pubsub/basePubSub.js";
import { delay } from "../../utils/async.js";
import { type BaseError } from "../baseErrors.js";
import { type BaseRouter } from "./baseRouter.js";
import { BaseHttpContext } from "./httpContext.js";
import { type BaseRequestHandlerConfig } from "./types.js";
import { config } from "../config/decorators/config.js";

@registerDi({setup: true, singleton: true, teardown: true, phase: 150})
export class BaseRequestHandler {
  #server!: http.Server;

  @di<BaseLogger>("BaseLogger", "RequestHandler")
  private accessor logger!: BaseLogger;

  @config<BaseRequestHandlerConfig>("BaseRequestHandler")
  private accessor config!: BaseRequestHandlerConfig;

  @di<BasePubSub>("BasePubSub")
  private accessor bus!: BasePubSub;

  @di<BaseRouter>("BaseRouter")
  private accessor router!: BaseRouter;

  constructor() {
    this.#server = http.createServer((req, res) => void this.handleRequest(req, res));
  }

  async setup() {
    const port = this.config.port;
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
      ctx.res.removeAllListeners();
    });

    ctx.res.once("error", (err: BaseError) => {
      this.logger.warn(err.message, [ctx.id], { err });
      ctx.res.removeAllListeners();
    });

    this.logger.info(`New request: ${ctx.topic}`, [ctx.id]);

    void this.bus.pub(ctx.topic, { context: ctx });

    await delay(this.config.requestTimeout);

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
