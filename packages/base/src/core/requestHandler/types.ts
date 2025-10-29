import type formidable from "formidable";
import { type BasePubSubArgs } from "../pubsub/types.js";
import { type BaseHttpContext } from "./httpContext.js";
import { type BaseContextData } from "../module/baseContext.js";
import type { BaseWebSocketContext } from "./websocketContext.js";

export interface BaseHttpActionArgs extends BasePubSubArgs {
  context: BaseHttpContext;
}

/**
 * Arguments passed to @upgrade handlers
 * Includes WebSocket context and URL pattern parameters extracted from the connection path
 */
export interface BaseWebSocketUpgradeArgs extends BasePubSubArgs {
  context: BaseWebSocketContext;
  params?: Record<string, string>;
}

/**
 * Arguments passed to @message handlers
 * Includes WebSocket context, message payload, and URL pattern parameters
 * from the combined connection path + message path
 */
export interface BaseWebSocketMessageArgs extends BasePubSubArgs {
  context: BaseWebSocketContext;
  payload?: unknown;
  params?: Record<string, string>;
}

/**
 * Arguments passed to @close handlers
 * Includes WebSocket context and URL pattern parameters extracted from the connection path
 */
export interface BaseWebSocketCloseArgs extends BasePubSubArgs {
  context: BaseWebSocketContext;
  params?: Record<string, string>;
}

/**
 * A container for arbitrary HTTP context data.
 * Modules can extend this interface to add their own typed properties.
 *
 * @example
 * declare module './types.js' {
 *   interface HttpContextData {
 *     user?: { id: string; name: string };
 *     session?: { token: string; expires: Date };
 *   }
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface HttpContextData extends BaseContextData {
    // Intentionally empty to allow declaration merging
}

export type UrlParams = Record<string, string>;
export type RouteHandler = (params: UrlParams) => string;
export type RouteTarget = string | RouteHandler;
export type Routes = Record<string, RouteTarget>;

export interface CookieOptions {
  expires?: Date;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
}

export interface ParsedForm<T> {
  fields: T;
  files: formidable.Files;
}