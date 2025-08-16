import { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { BaseContext, type BaseContextData } from "../module/baseContext.js";
import { type BaseActionArgs } from "../module/types.js";
import type { BaseHttpContext } from "./httpContext.js";

export interface BaseWebSocketActionArgs extends BaseActionArgs {
  context: BaseWebSocketContext;
}

export class BaseWebSocketContext extends BaseContext<BaseContextData> {
  #ws: WebSocket;
  public readonly httpContext: BaseHttpContext;
  public readonly path: string;

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
   * Clean up the context when the connection closes
   * Removes all event listeners to prevent memory leaks
   */
  destroy(): void {
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
