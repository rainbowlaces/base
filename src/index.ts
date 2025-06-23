import { Base } from "./core/base";
import { BaseModule } from "./core/baseModule";
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

import { BaseTemplates } from "./modules/templates";
import { BaseStatic } from "./modules/static";

import { LogLevel } from "./core/logger/types";
import {
  BaseActionArgs,
  BaseHttpActionArgs,
  BaseAction,
} from "./core/baseAction";
import { BaseContext } from "./core/baseContext";
import { BaseRequest } from "./core/requestHandler/baseRequest";
import { BaseResponse } from "./core/requestHandler/baseResponse";
import { BaseHttpContext } from "./core/requestHandler/httpContext";

import { request } from "./decorators/actions/request";
import { global } from "./decorators/actions/global";
import { init } from "./decorators/actions/init";

import { config } from "./decorators/config";
import { dependsOn } from "./decorators/dependsOn";
import { di } from "./decorators/di";
import { sub } from "./decorators/sub";
import { baseModule } from "./decorators/baseModule";
import { BaseDi } from "./core/baseDi";
import { Constructor, Scalar, Instance, BaseDiWrapper } from "./core/types";

// Add missing framework classes
import { BaseError } from "./core/baseErrors";
import { BasePubSub, BasePubSubArgs, Subscriber } from "./core/basePubSub";
import { BaseLogger } from "./core/logger";
import { LogMessage } from "./core/logger/logMessage";
import { BaseConfig } from "./core/config";
import { ConfigObject } from "./core/config/types";
import { BaseRequestHandler } from "./core/requestHandler";
import { BaseRouter } from "./core/requestHandler/baseRouter";
import { BaseInitContext } from "./core/initContext";

export const decorators = {
  config,
  request,
  di,
  dependsOn,
  init,
  sub,
  global,
  baseModule,
};

// Export decorators directly
export {
  config,
  request,
  di,
  dependsOn,
  init,
  sub,
  global,
  baseModule,
};

// Export utils directly
export {
  asyncUtils as async,
  fileUtils as file,
  recursionUtils as recursion,
  stringUtils as string,
};

export {
  BaseTemplates,
  BaseStatic,
  BaseContext,
  BaseHttpContext,
  BaseRequest,
  BaseResponse,
  BaseDi,
  BaseError,
  BasePubSub,
  BaseLogger,
  BaseConfig,
  BaseRequestHandler,
  BaseRouter,
  BaseInitContext,
  LogMessage,
};

export { LogLevel };
export { Base };
export { BaseModule, html };
export type {
  LoadedElements,
  LoadedTags,
  TemplateData,
  BaseActionArgs,
  BaseHttpActionArgs,
  BaseAction,
  BasePubSubArgs,
  Subscriber,
  ConfigObject,
  Constructor,
  Scalar,
  Instance,
  BaseDiWrapper,
};
