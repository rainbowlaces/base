import { Dependable } from "../dependencyManager/types";
import { RequestHandler } from "express";

export interface BaseRequestHandler extends RequestHandler, Dependable {
  httpMethod?: string;
  path?: string;
  isMiddleware?: boolean;
  isInit?: boolean;
}
