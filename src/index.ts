import Base from "./core/base";
import BaseModule from "./core/baseModule";
import {
  html,
  LoadedElements,
  LoadedTags,
  TemplateData,
} from "./modules/templates/engine";

import * as asyncUtils from "./utils/async";
import * as fileUtils from "./utils/file";
import * as recursionUtils from "./utils/recursion";
import * as stringUtils from "./utils/string";

import BaseTemplates from "./modules/templates";
import BaseStaticFiles from "./modules/static";

import { LogLevel } from "./core/logger/types";
import { BaseActionArgs, BaseHttpActionArgs } from "./core/baseAction";
import BaseContext from "./core/baseContext";
import BaseRequest from "./core/requestHandler/baseRequest";
import BaseResponse from "./core/requestHandler/baseResponse";

import request from "./decorators/actions/request";
import global from "./decorators/actions/global";
import init from "./decorators/actions/init";
import noHandle from "./decorators/actions/noHandle";

import config from "./decorators/config";
import dependsOn from "./decorators/dependsOn";
import di from "./decorators/di";
import sub from "./decorators/sub";

export const decorators = {
  config,
  request,
  noHandle,
  di,
  dependsOn,
  init,
  sub,
  global,
};

export const utils = {
  async: asyncUtils,
  file: fileUtils,
  recursion: recursionUtils,
  string: stringUtils,
};

export {
  BaseTemplates,
  BaseStaticFiles,
  BaseContext,
  BaseRequest,
  BaseResponse,
};

export { LogLevel };
export default Base;
export { BaseModule, html };
export type {
  LoadedElements,
  LoadedTags,
  TemplateData,
  BaseActionArgs,
  BaseHttpActionArgs,
};
