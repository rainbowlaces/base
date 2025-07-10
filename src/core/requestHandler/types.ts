import type formidable from "formidable";
import { tmpdir } from "os";
import { BaseClassConfig, type ConfigData } from "../config/types";
import { configClass } from "../config/decorators/provider";

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

declare module "../config/types" {
  interface BaseAppConfig {
    BaseRequestHandler?: ConfigData<BaseRequestHandlerConfig>;
  }
}