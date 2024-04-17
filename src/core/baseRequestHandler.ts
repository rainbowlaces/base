import BaseContext from "./baseContext";
import http from "http";
import BaseLogger from "./logger";
import di from "../decorators/di";
import BaseConfig from "./config";
import BasePubSub from "./basePubSub";
import { delay } from "../utils/async";
import BaseError from "./baseErrors";

export default class BaseRequestHandler {
  private _requests: Map<string, BaseContext> = new Map<string, BaseContext>();
  private _server!: http.Server;

  @di<BaseLogger>("BaseLogger", "request_handler")
  private _logger!: BaseLogger;

  @di<BaseConfig>("BaseConfig", "request_handler")
  private _config!: BaseConfig;

  @di<BasePubSub>("BasePubSub")
  private _bus!: BasePubSub;

  constructor() {
    this._server = http.createServer(this.handleRequest.bind(this));
  }

  async go() {
    const port = this._config.get("port", process.env.PORT || 3000);
    this._server.listen(port, () => {
      this._logger.info(`Server listening on port ${port}`);
    });
  }

  private async handleContext(ctx: BaseContext) {
    ctx.res.on("done", () => {
      this._requests.delete(ctx.id);
    });

    ctx.res.on("error", (err: BaseError) => {
      this._logger.warn(err.message, [ctx.id], { err });
      this._requests.delete(ctx.id);
    });

    ctx.res.on("redirect", (url: string) => {
      const req = ctx.req.rawRequest;
      const res = ctx.res.rawResponse;

      if (!req || !res) return;

      ctx.res.finish();

      req.url = url;

      this.handleRequest(req, res);
    });

    this._logger.info(`New request: ${ctx.topic}`, [ctx.id]);

    this._bus.pub(ctx.topic, { context: ctx });

    await delay(this._config.get<number>("routingTimeout", 50));

    if (!ctx.handled) {
      this._logger.warn("Request not handled.", [ctx.id]);
      ctx.res.statusCode(404);
      ctx.res.send("Not found.");
      this._requests.delete(ctx.id);
    }

    await delay(this._config.get<number>("requestTimeout", 5000));

    if (ctx.res.finished) return;
    this._logger.warn("Request timed out.", [ctx.id]);
    ctx.res.statusCode(408);
    ctx.res.send("Request timed out.");
    this._requests.delete(ctx.id);
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    const ctx = new BaseContext(req, res);
    this._requests.set(ctx.id, ctx);

    return this.handleContext(ctx);
  }
}
