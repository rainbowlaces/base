import http from "http";
import { type BaseLogger } from "../logger";
import { register } from "../../decorators/register";
import { di } from "../../decorators/di";
import { type BaseConfig } from "../config";
import { type BasePubSub } from "../basePubSub";
import { delay } from "../../utils/async";
import { type BaseError } from "../baseErrors";
import { type BaseRouter } from "./baseRouter";
import { BaseHttpContext } from "./httpContext";

@register()
export class BaseRequestHandler {
  private _server!: http.Server;

  @di<BaseLogger>("BaseLogger", "request_handler")
  private accessor _logger!: BaseLogger;

  @di<BaseConfig>("BaseConfig", "base")
  private accessor _config!: BaseConfig;

  @di<BasePubSub>("BasePubSub")
  private accessor _bus!: BasePubSub;

  @di<BaseRouter>("BaseRouter")
  private accessor _router!: BaseRouter;

  constructor() {
    this._server = http.createServer((req, res) => void this.handleRequest(req, res));
  }

  async go() {
    const port = this._config.get("port", process.env.PORT ?? 3000);
    this._server.listen(port, () => {
      this._logger.info(`Server listening on port ${port}`);
    });
  }

  private async handleContext(ctx: BaseHttpContext) {
    ctx.res.on("done", () => {
      this._logger.info("Request done.", [ctx.id]);
    });

    ctx.res.on("error", (err: BaseError) => {
      this._logger.warn(err.message, [ctx.id], { err });
    });

    this._logger.info(`New request: ${ctx.topic}`, [ctx.id]);

    void this._bus.pub(ctx.topic, { context: ctx });

    await delay(this._config.get<number>("requestTimeout", 5000));

    if (ctx.res.finished) return;

    this._logger.warn("Request timed out.", [ctx.id]);
    ctx.res.statusCode(408);
    void ctx.res.send("Request timed out.");
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    const _url = new URL(req.url ?? "", `http://example.com`);
    const rw = this._router.handleRoute(_url.pathname);

    if (rw.rewrite) {
      this._logger.debug(`Rewriting ${rw.original || "/"} >> ${rw.target}`);
      req.url = rw.target + _url.search;
    }

    const ctx = new BaseHttpContext(req, res);
    return this.handleContext(ctx);
  }
}
