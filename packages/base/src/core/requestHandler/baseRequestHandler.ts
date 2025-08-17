import http from "http";
import { WebSocketServer } from "ws";
import type { Duplex } from "stream";
import { BaseLogger } from "../logger/baseLogger.js";
import { registerDi } from "../di/decorators/registerDi.js";
import { di } from "../di/decorators/di.js";
import { type BasePubSub } from "../pubsub/basePubSub.js";
import { type BaseRouter } from "./baseRouter.js";
import { BaseHttpContext } from "./httpContext.js";
import { config } from "../config/decorators/config.js";
import { BaseClassConfig } from "../config/types.js";
import { configClass } from "../config/decorators/configClass.js";
import type formidable from "formidable";
import { tmpdir } from "os";

@configClass('BaseRequestHandler')
export class BaseRequestHandlerConfig extends BaseClassConfig {
  requestTimeout: number = 5000;
  port: number = 3000;
  cookieSecret: string = "";
  maxBodySize: number = 1024 * 1024; // 1MB
  formEncoding: formidable.BufferEncoding = 'utf8';
  uploadDir: string = tmpdir();
  keepExtensions: boolean = false;
  maxUploadSize: number = 1024 * 1024; // 1MB
  maxFields: number = 1000;
}

declare module "../config/types.js" {
  interface BaseAppConfig {
    BaseRequestHandler?: ConfigData<BaseRequestHandlerConfig>;
  }
}

@registerDi({setup: true, singleton: true, teardown: true, phase: 150})
export class BaseRequestHandler {
  #server!: http.Server;
  #wss!: WebSocketServer;

  @di(BaseLogger, "RequestHandler")
  private accessor logger!: BaseLogger;

  @config('BaseRequestHandler')
  private accessor config!: BaseRequestHandlerConfig;

  @di<BasePubSub>("BasePubSub")
  private accessor bus!: BasePubSub;

  @di<BaseRouter>("BaseRouter")
  private accessor router!: BaseRouter;

  constructor() {
    this.#server = http.createServer((req, res) => void this.handleRequest(req, res));
    this.#wss = new WebSocketServer({ noServer: true });
  }

  async setup() {
    const port = this.config.port;
    
    // Set up WebSocket upgrade handling
    this.#server.on('upgrade', (request, socket, head) => {
      this.handleUpgrade(request, socket, head);
    });

    this.#server.listen(port, () => {
      this.logger.info(`Server listening on port ${port} (HTTP + WebSocket)`);
    });
  }

  async teardown() {
    this.#server.removeAllListeners();
    this.#wss.removeAllListeners();
    this.#wss.close();
    this.#server.closeAllConnections();
  }

  private async handleContext(ctx: BaseHttpContext) {
    this.logger.debug(`New request: ${ctx.topic}`, [ctx.id]);
    void this.bus.pub(ctx.topic, { context: ctx });
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

  /**
   * Handle WebSocket upgrade requests using the "Promotable Request" model
   * This creates a normal BaseHttpContext and publishes standard HTTP topics
   * Authentication and middleware will run normally, then @request handlers can call context.upgrade()
   */
  private handleUpgrade(request: http.IncomingMessage, socket: Duplex, head: Buffer) {
    this.logger.debug(`Received upgrade request for ${request.url}, treating as promotable HTTP request`);
    
    // Apply routing logic just like normal HTTP requests
    const _url = new URL(request.url ?? "", `http://example.com`);
    const rw = this.router.handleRoute(_url.pathname);

    if (rw.rewrite) {
      this.logger.debug(`Rewriting ${rw.original || "/"} >> ${rw.target}`);
      request.url = rw.target + _url.search;
    }

    // Create a special BaseHttpContext that knows it's upgradable
    // We pass undefined for res since this is an upgrade request, plus socket, head, and WSS
    const ctx = new BaseHttpContext(request, undefined, socket, head, this.#wss);
    
    // Publish to normal HTTP topic - this triggers @request middleware pipeline
    return this.handleContext(ctx);
  }
}
