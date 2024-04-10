import { Request, NextFunction, json, urlencoded } from "express";
import cookieParserLib from "cookie-parser";
import BaseModule from "../../core/baseModule";
// import middleware from "../../decorators/middleware";
import init from "../../decorators/init";
import config from "../../decorators/config";
import { randomBytes } from "crypto";
import BaseResponse from "../../core/baseResponse";
import { IncomingMessage, ServerResponse } from "http";

interface NextHandleFunction {
  (
    req: IncomingMessage,
    res: ServerResponse,
    next: NextFunction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any;
}

export default class RequestParser extends BaseModule {
  @config()
  cookieSecret: string = randomBytes(32).toString("hex");

  @init
  json() {
    return this.getMiddleware(json());
  }

  @init
  formEncoding() {
    return this.getMiddleware(urlencoded({ extended: true }));
  }

  @init
  cookieParser() {
    const middleware = cookieParserLib(this.cookieSecret);
    return (req: Request, res: BaseResponse, next: NextFunction) => {
      middleware(req, res.expressResponse, next);
      return Promise.resolve();
    };
  }

  private getMiddleware(middleware: NextHandleFunction) {
    return (req: Request, res: BaseResponse, next: NextFunction) => {
      middleware(req as unknown as IncomingMessage, res.expressResponse, next);
      return Promise.resolve();
    };
  }
}
