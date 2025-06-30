import type formidable from "formidable";
import { type BaseClassConfig } from "../config/types";

export type HttpContextData = Record<string, unknown>;
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

export interface BaseRequestHandlerConfig extends BaseClassConfig {
  requestTimeout?: number;
  port?: number;
  cookieSecret?: string;
  maxBodySize?: number;
  formEncoding?: formidable.BufferEncoding;
  uploadDir?: string;
  keepExtensions?: boolean;
  maxUploadSize?: number;
  maxFields?: number;
}

declare module "../config/types" {
  interface BaseAppConfig {
    BaseRequestHandler?: BaseRequestHandlerConfig;
  }
}