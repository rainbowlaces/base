import Base from "./core/base";
import BaseModule from "./core/baseModule";
import {
  html,
  LoadedElements,
  LoadedTags,
  TemplateData,
} from "./modules/templates/engine";

import config from "./decorators/config";
import action from "./decorators/action";
import dependsOn from "./decorators/dependsOn";
import di from "./decorators/di";
import init from "./decorators/init";
import sub from "./decorators/sub";

import * as asyncUtils from "./utils/async";
import * as fileUtils from "./utils/file";
import * as recursionUtils from "./utils/recursion";
import * as stringUtils from "./utils/string";

import BaseTemplates from "./modules/templates";
import BaseStaticFiles from "./modules/static";

import { LogLevel } from "./core/logger/types";

export const decorators = {
  config,
  action,
  di,
  dependsOn,
  init,
  sub,
};

export const utils = {
  async: asyncUtils,
  file: fileUtils,
  recursion: recursionUtils,
  string: stringUtils,
};

export { BaseTemplates, BaseStaticFiles };

export { LogLevel };
export default Base;
export { BaseModule, html };
export type { LoadedElements, LoadedTags, TemplateData };
