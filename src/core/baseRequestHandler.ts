import { MatchFunction } from "path-to-regexp";
import { Dependable } from "../dependencyManager/types";
import { Request, NextFunction } from "express";
import BaseResponse from "./baseResponse";

interface BaseRequestHandlerProperties extends Dependable {
  httpMethod?: string;
  path?: string;
  pathMatcher?: MatchFunction;
  isMiddleware?: boolean;
  isInit?: boolean;
}

export interface BaseRequestHandler extends BaseRequestHandlerProperties {
  (req: Request, res: BaseResponse, next: NextFunction): Promise<void>;
}

export interface BaseInitializableRequestHandler
  extends BaseRequestHandlerProperties {
  (): BaseRequestHandler;
}
