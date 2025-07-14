import type formidable from "formidable";
import { tmpdir } from "os";
import { BaseClassConfig, type ConfigData } from "../config/types.js";
import { configClass } from "../config/decorators/provider.js";
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

@configClass("BaseRequestHandler")
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