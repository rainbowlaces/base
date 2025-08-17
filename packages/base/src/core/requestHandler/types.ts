import type formidable from "formidable";
import { type BasePubSubArgs } from "../pubsub/types.js";
import { type BaseHttpContext } from "./httpContext.js";
import { type BaseContextData } from "../module/baseContext.js";

export interface BaseHttpActionArgs extends BasePubSubArgs {
  context: BaseHttpContext;
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