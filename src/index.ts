import Base from "./core/base";
import BaseModule from "./core/baseModule";
import {
  html,
  LoadedElements,
  LoadedTags,
  TemplateData,
} from "./modules/templates/engine";

import config from "./decorators/config";
import path from "./decorators/path";
import middleware from "./decorators/middleware";
import dependsOn from "./decorators/dependsOn";
import method from "./decorators/method";
import namespace from "./decorators/namespace";
import command from "./decorators/command";
import inject from "./decorators/inject";

import * as asyncUtils from "./utils/async";
import * as fileUtils from "./utils/file";
import * as recursionUtils from "./utils/recursion";
import * as stringUtils from "./utils/string";

import Templates from "./modules/templates";
import Static from "./modules/static";

import { Request, Response, NextFunction } from "express";

export type { Request, Response, NextFunction };

import CommandQueue, { Command } from "./core/commandQueue";
import { LogLevel } from "./logger/types";

export type { Command };

export { CommandQueue };

export const decorators = {
  config,
  path,
  middleware,
  dependsOn,
  method,
  namespace,
  command,
  inject,
};

export const utils = {
  async: asyncUtils,
  file: fileUtils,
  recursion: recursionUtils,
  string: stringUtils,
};

export { Templates, Static };

export { LogLevel };
export default Base;
export { BaseModule, html };
export type { LoadedElements, LoadedTags, TemplateData };
