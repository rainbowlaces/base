import { MatchFunction } from "path-to-regexp";
import { Dependable } from "../dependencyManager/types";
import { RequestHandler } from "express";

export interface BaseRequestHandler extends RequestHandler, Dependable {
  httpMethod?: string;
  path?: string;
  pathMatcher?: MatchFunction;
  isMiddleware?: boolean;
  isInit?: boolean;
}
