import * as http from "http";
import type { Duplex } from "stream";
import type { WebSocketServer, WebSocket } from "ws";
import { registerDi } from "../di/decorators/registerDi.js";
import { di } from "../di/decorators/di.js";
import { BaseContext } from "../module/baseContext.js";
import { type HttpContextData, type BaseRequestHandlerConfig } from "./types.js";
import { BaseRequest } from "./baseRequest.js";
import { BaseResponse } from "./baseResponse.js";
import { BaseError } from "../baseErrors.js";
import { BaseWebSocketContext } from "./websocketContext.js";
import { type BasePubSub } from "../pubsub/basePubSub.js";
import { config } from "../config/decorators/config.js";
import { BaseContext as _BaseContextStatic } from "../module/baseContext.js";
import { getActionMetadata } from "./metadata.js";

@registerDi()
export class BaseHttpContext extends BaseContext<HttpContextData> {
  #req: BaseRequest;
  #res: BaseResponse;
  #topic: string;
  #socket?: Duplex;
  #head?: Buffer;
  #wss?: WebSocketServer;
  #timeoutTimer: NodeJS.Timeout | null = null;
  #baseTimeoutMs = 0;

  @config<BaseRequestHandlerConfig>("BaseRequestHandler")
  private accessor handlerConfig!: BaseRequestHandlerConfig;

  @di<BasePubSub>("BasePubSub")
  private accessor bus!: BasePubSub;

  constructor(req: http.IncomingMessage, res?: http.ServerResponse, socket?: Duplex, head?: Buffer, wss?: WebSocketServer) {
    super(
      (id: string, module: string, action: string, status: string) =>
        `/request/${id}/${module}/${action}/${status}`,
    );

    this.#req = new BaseRequest(this.id, req);
    
    // For WebSocket upgrade requests, we don't have a real ServerResponse
    // Create a dummy one or handle the case where res is undefined
    if (res) {
      this.#res = new BaseResponse(this.id, res);
    } else {
      // Create a dummy response for upgrade requests
      // This response will be replaced when upgrade() is called
      const dummyRes = new http.ServerResponse(req);
      this.#res = new BaseResponse(this.id, dummyRes);
    }

    // Store upgrade-related parameters
    this.#socket = socket;
    this.#head = head;
    this.#wss = wss;

  this.#topic = `/request/${this.id}/${this.#req.method}${this.#req.cleanPath}`;

  // Compute timeout (max action timeout or global default)
  this.#baseTimeoutMs = this._computeInitialTimeout();

    if (res) {
      this.#res.on("done", () => {
        this._clearTimeoutTimer();
        this.done();
      });
      this.#res.on("error", () => {
        this._clearTimeoutTimer();
        this.error();
      });
      // Listen for dynamic timeout extensions
      this.#res.on("extend-timeout", (ms: number) => {
        this.logger.debug(`Extending timeout to ${ms}ms`, [this.id]);
        this._armTimeout(ms);
      });
      // Arm initial timeout
      this._armTimeout(this.#baseTimeoutMs);
    }

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

  /**
   * Check if this HTTP context can be upgraded to WebSocket
   */
  get isUpgradable(): boolean {
    return !!(this.#socket && this.#head && this.#wss);
  }

  /**
   * Upgrade this HTTP context to a WebSocket connection
   * This implements the "Promotable Request" model
   */
  upgrade(): void {
    if (!this.isUpgradable || !this.#socket || !this.#head || !this.#wss) {
      throw new BaseError("This request is not upgradable - missing socket, head, or WebSocketServer");
    }

    if (this.#res.headersSent) {
      throw new BaseError("Cannot upgrade - HTTP response has already been sent");
    }

    this.logger.debug(`Upgrading HTTP context to WebSocket`, [this.id]);

    // Get the raw request - it should always be available
    const rawRequest = this.#req.rawRequest;
    if (!rawRequest) {
      throw new BaseError("Cannot upgrade - raw request is not available");
    }

    // Complete the WebSocket handshake
    this.#wss.handleUpgrade(rawRequest, this.#socket, this.#head, (ws: WebSocket) => {
      // Create the WebSocket context, passing this HTTP context to preserve state
      const wsContext = new BaseWebSocketContext(ws, this);
      
      this.logger.debug(`WebSocket connection established`, [wsContext.id], { path: wsContext.path });

      // Set up WebSocket event handlers
      ws.on('message', (data: Buffer) => {
        this.handleWebSocketMessage(wsContext, data);
      });

      ws.on('close', () => {
        this.logger.debug(`WebSocket connection closed`, [wsContext.id]);
        wsContext.destroy();
      });

      ws.on('error', (error: Error) => {
        this.logger.warn(`WebSocket connection error`, [wsContext.id], { error });
        wsContext.error();
        wsContext.destroy();
      });

      // Publish upgrade event for @upgrade handlers
      const upgradeTopic = `/websocket/upgrade${wsContext.path}`;
      this.logger.debug(`Publishing upgrade event`, [wsContext.id], { topic: upgradeTopic });
      void this.bus.pub(upgradeTopic, { context: wsContext });
    });

    // Mark this HTTP context as done since it's now been promoted
    this.done();
  }

  /** Compute initial timeout using static action registry */
  private _computeInitialTimeout(): number {
    let computed = this.handlerConfig.requestTimeout;
    try {
      const { actions } = _BaseContextStatic.getActionsForTopic(this.#topic);
      const max = actions.reduce<number | undefined>((acc, a) => {
        const meta = getActionMetadata(a);
        if (meta?.timeout !== undefined) return acc === undefined ? meta.timeout : Math.max(acc, meta.timeout);
        return acc;
      }, undefined);
      if (max !== undefined) computed = max;
    } catch (err) {
      this.logger.warn("Timeout computation failed; using default", [this.id], { err });
    }
    this.logger.debug(`Initial context timeout ${computed}ms`, [this.id]);
    return computed;
  }

  private _armTimeout(ms: number) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    if (this.#timeoutTimer) clearTimeout(this.#timeoutTimer);
    this.#timeoutTimer = setTimeout(() => {
      if (this.#res.finished) return;
      this.logger.warn(`Request timed out after ${ms}ms`, [this.id]);
      this.#res.statusCode(408);
      void this.#res.send("Request timed out.");
    }, ms);
  }

  private _clearTimeoutTimer() {
    if (this.#timeoutTimer) clearTimeout(this.#timeoutTimer);
    this.#timeoutTimer = null;
  }

  /**
   * Handle incoming WebSocket messages (moved from BaseRequestHandler)
   */
  private handleWebSocketMessage(context: BaseWebSocketContext, data: Buffer) {
    try {
      const payload = JSON.parse(data.toString());
      const topic = `/websocket/message${context.path}`;
      
      this.logger.debug(`WebSocket message received`, [context.id], { topic, payload });
      
      // Publish to the PubSub bus - this triggers the @websocket/@message handlers
      void this.bus.pub(topic, { context, payload });
      
    } catch (error) {
      this.logger.warn(`Failed to parse WebSocket message`, [context.id], { error, data: data.toString() });
      // Don't close connection on parse error, just ignore the message
    }
  }
}
