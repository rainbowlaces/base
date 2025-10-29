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
// Import to ensure BaseWebSocketManager is registered in DI
import "./websocketManager.js";

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
  treat404AsError: boolean = false;
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
    
    this.#server.on('upgrade', (request, socket, head) => {
      this.handleUpgrade(request, socket, head);
    });

    this.#server.listen(port, () => {
      this.logger.info(`Server listening on port ${port} (HTTP + WebSocket)`);
    });
  }

  async teardown() {
    const server = this.#server;
    const wss = this.#wss;

    server.removeAllListeners('request');
    server.removeAllListeners('upgrade');

    try {
      wss.clients.forEach((client) => {
        try { client.terminate(); } catch { /* ignore */ }
      });
      wss.removeAllListeners();
      wss.close();
    } catch { /* ignore */ }

    await new Promise<void>((resolve) => {
      let resolved = false;
      const forceTimer = setTimeout(() => {
        try {
          const s = server as typeof server & {
            closeAllConnections?: () => void;
            closeIdleConnections?: () => void;
          };
          s.closeAllConnections?.();
          s.closeIdleConnections?.();
        } catch { /* ignore */ }
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 1500).unref();

      try {
        server.close((err?: Error) => {
          clearTimeout(forceTimer);
          if (err) {
            this.logger.error('Error closing HTTP server', [], { err });
          } else {
            this.logger.info('HTTP server closed');
          }
          if (!resolved) {
            resolved = true;
            resolve();
          }
        });
      } catch (err) {
        clearTimeout(forceTimer);
        this.logger.error('Exception invoking server.close()', [], { err });
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }
    });
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

  private handleUpgrade(request: http.IncomingMessage, socket: Duplex, head: Buffer) {
    this.logger.debug(`Received upgrade request for ${request.url}, treating as promotable HTTP request`);
    
    const _url = new URL(request.url ?? "", `http://example.com`);
    const rw = this.router.handleRoute(_url.pathname);

    if (rw.rewrite) {
      this.logger.debug(`Rewriting ${rw.original || "/"} >> ${rw.target}`);
      request.url = rw.target + _url.search;
    }

    const ctx = new BaseHttpContext(request, undefined, socket, head, this.#wss);
    return this.handleContext(ctx);
  }
}
