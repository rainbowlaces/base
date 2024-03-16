import { json, urlencoded } from "express";
import cookieParserLib from "cookie-parser";
import BaseModule from "../../core/baseModule";
import middleware from "../../decorators/middleware";
import init from "../../decorators/init";
import config from "../../decorators/config";
import { randomBytes } from "crypto";

export default class RequestParser extends BaseModule {
  @config()
  cookieSecret: string = randomBytes(32).toString("hex");

  @init
  @middleware
  json() {
    return json();
  }

  @init
  @middleware
  formEncoding() {
    return urlencoded({ extended: true });
  }

  @init
  @middleware
  cookieParser() {
    return cookieParserLib(this.cookieSecret);
  }
}
