import { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { BaseContext, type BaseContextData } from "../module/baseContext.js";
import { type BaseActionArgs } from "../module/types.js";
import type { BaseHttpContext } from "./httpContext.js";
import { BaseDi } from "../di/baseDi.js";
import type { BaseWebSocketManager } from "./websocketManager.js";
import { BasePubSub } from "../pubsub/basePubSub.js";

export interface BaseWebSocketActionArgs extends BaseActionArgs {
  context: BaseWebSocketContext;
  payload?: unknown;
}

export class BaseWebSocketContext extends BaseContext<BaseContextData> {
  #ws: WebSocket;
  public readonly httpContext: BaseHttpContext;
  public readonly path: string;
  private manager: BaseWebSocketManager;
  private pubsub: BasePubSub;

  constructor(ws: WebSocket, originalHttpContext: BaseHttpContext) {
    super((id: string, module: string, action: string, status: string) =>
      `/websocket/${id}/${module}/${action}/${status}`
    );

    this.#ws = ws;
    this.httpContext = originalHttpContext;
    this.path = new URL(originalHttpContext.req.rawRequest?.url || "/", "http://localhost").pathname;
    
    // Inherit data from the original HTTP context (like authenticated user)
    // This properly transfers the internal data object for state preservation
    // @ts-expect-error - Accessing protected method for context handoff
    this._setDataFromHandoff(originalHttpContext._getDataForHandoff());

    // Register with the manager
    this.manager = BaseDi.resolve("BaseWebSocketManager");
    this.pubsub = BaseDi.resolve(BasePubSub);
    this.manager.register(this);

    // Publish upgrade event
    this.pubsub.pub(`/websocket/upgrade${this.path}`, { context: this });
  }

  protected getContextType(): string {
    return "websocket";
  }

  /**
   * Send JSON data to the WebSocket client
   * Only sends if the connection is open
   */
  send(data: object): void {
    if (this.#ws.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(data));
    } else {
      this.logger.warn(`Attempted to send data on non-open WebSocket`, [this.id], {
        readyState: this.#ws.readyState,
        data
      });
    }
  }

  /**
   * Handle incoming WebSocket message with multiplexing support
   * Expected message format: { "path": "/route", "payload": {...} }
   * If no path is provided, defaults to "/"
   */
  handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as { path?: string; payload?: unknown };
      
      // Default to "/" if no path specified
      const messagePath = message.path || "/";
      
      // Construct full topic: connection path + message path
      const fullMessageTopic = `/websocket/message${this.path}${messagePath}`;
      
      this.logger.debug(`WebSocket message received`, [this.id], {
        connectionPath: this.path,
        messagePath,
        fullTopic: fullMessageTopic
      });
      
      // Publish to PubSub with context and payload
      this.pubsub.pub(fullMessageTopic, { 
        context: this, 
        payload: message.payload 
      });
      
    } catch (error) {
      this.logger.warn(`Failed to parse WebSocket message`, [this.id], { 
        error, 
        data: data.toString() 
      });
      // Don't close connection on parse error, just ignore the message
    }
  }

  /**
   * Clean up the context when the connection closes
   * Removes all event listeners to prevent memory leaks
   */
  destroy(): void {
    // Unregister from manager first
    this.manager.unregister(this);
    
    // Publish close event
    this.pubsub.pub(`/websocket/close${this.path}`, { context: this });
    
    // Clean up listeners
    this.removeAllListeners();
    this.logger.debug(`WebSocket context destroyed`, [this.id]);
  }

  /**
   * Get the original HTTP upgrade request
   */
  get request(): IncomingMessage | undefined {
    return this.httpContext.req.rawRequest;
  }

  /**
   * Get the WebSocket instance
   */
  get socket(): WebSocket {
    return this.#ws;
  }
}
