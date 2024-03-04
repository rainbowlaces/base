import { json, urlencoded } from "express";
import cookieParserLib from "cookie-parser";
import BaseModule from "../../core/baseModule";
import middleware from "../../decorators/middleware";
import init from "../../decorators/init";

export default class RequestParser extends BaseModule {
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
    return cookieParserLib();
  }
}
