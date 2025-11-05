// Core exports
export { Base } from "./core/base.js";
export { BaseModule } from "./core/module/baseModule.js";
export { LogLevel } from "./core/logger/types.js";
export { BaseContext } from "./core/module/baseContext.js";
export { BaseError } from "./core/baseErrors.js";
export { BasePubSub } from "./core/pubsub/basePubSub.js";
export { BaseLogger, LoggerConfig } from "./core/logger/baseLogger.js";
export { LogMessage } from "./core/logger/logMessage.js";

// Logger transformers and redactors
export { ErrorSerializer } from "./core/logger/transformers/errorSerializer.js";
export { ConstructorSerializer } from "./core/logger/transformers/constructorSerializer.js";
export { ScalarSerializer } from "./core/logger/transformers/scalarSerialiser.js";
export { PatternRedactor } from "./core/logger/redactors/patternRedactor.js";
export { EmailRedactor } from "./core/logger/redactors/emailRedactor.js";
export { PhoneNumberRedactor } from "./core/logger/redactors/phoneNumberRedactor.js";
export { CreditCardRedactor } from "./core/logger/redactors/creditCardRedactor.js";
export { IpAddressRedactor } from "./core/logger/redactors/ipAddressRedactor.js";
export { UkPostCodeRedactor } from "./core/logger/redactors/ukPostCodeRedactor.js";
export { ZipCodeRedactor } from "./core/logger/redactors/zipCodeRedactor.js";
export { SsnRedactor } from "./core/logger/redactors/ssnRedactor.js";
export { NiNumberRedactor } from "./core/logger/redactors/niNumberRedactor.js";
export { BaseConfig } from "./core/config/baseConfig.js";
export { BaseClassConfig } from "./core/config/types.js";
export { BaseConfigProvider, BaseConfigRegistry } from "./core/config/baseConfigRegistry.js";

// Models exports
export { BaseModel as BaseModel } from "./core/models/baseModel.js";
export { BaseIdentifiableModel } from "./core/models/baseIdentifiableModel.js";
export { BaseModelCollection } from "./core/models/baseModelCollection.js";
export { UniqueID } from "./core/models/uniqueId.js";

// Request handler exports
export { BaseRequest } from "./core/requestHandler/baseRequest.js";
export { BaseResponse } from "./core/requestHandler/baseResponse.js";
export { BaseRouter } from "./core/requestHandler/baseRouter.js";
export { BaseHttpContext } from "./core/requestHandler/httpContext.js";
export { BaseWebSocketContext } from "./core/requestHandler/websocketContext.js";
export { BaseWebSocketManager } from "./core/requestHandler/websocketManager.js";
export { BaseRequestHandler } from "./core/requestHandler/baseRequestHandler.js";

// DI exports
export { BaseDi } from "./core/di/baseDi.js";
export { BaseAutoload } from "./core/di/baseAutoload.js";
export { BaseInitializer } from "./core/di/baseInitializer.js";

// Module exports
export { BaseStatic } from "./modules/static/baseStatic.js"
export { BaseDevtools } from "./modules/devtools/devtools.js";

// Template exports
export { BaseTemplate } from "./modules/templates/baseTemplate.js";
export { BaseTemplates } from "./modules/templates/baseTemplates.js";
export { TemplateResult } from "./modules/templates/engine/templateResult.js";
export { html } from "./modules/templates/engine/html.js";

// Template tags (need to be imported to register with TemplateTags interface)
export { EachTag } from "./modules/templates/engine/tags/eachTag.js";
export { IfTag } from "./modules/templates/engine/tags/ifTag.js";
export { UnsafeTag } from "./modules/templates/engine/tags/unsafeTag.js";

// Decorator exports
export { provider as config } from "./core/config/decorators/provider.js";
export { request } from "./core/requestHandler/decorators/request.js";
export { upgrade } from "./core/requestHandler/decorators/upgrade.js";
export { message } from "./core/requestHandler/decorators/websocket.js";
export { close } from "./core/requestHandler/decorators/close.js";
export { di } from "./core/di/decorators/di.js";
export { provider } from "./core/config/decorators/provider.js";
export { configClass } from "./core/config/decorators/configClass.js";
export { registerDi } from "./core/di/decorators/registerDi.js";
export { dependsOn } from "./core/module/decorators/dependsOn.js";
export { sub } from "./core/pubsub/decorators/sub.js";
export { baseModule } from "./core/module/decorators/baseModule.js";

// Model decorators
export { model } from "./core/models/decorators/model.js";
export { field } from "./core/models/decorators/field.js";
export { embedMany } from "./core/models/decorators/embedMany.js";
export { embedMap } from "./core/models/decorators/embedMap.js";
export { embedOne } from "./core/models/decorators/embedOne.js";
export { referenceMany } from "./core/models/decorators/referenceMany.js";
export { referenceOne } from "./core/models/decorators/referenceOne.js";
export { meta } from "./core/models/decorators/meta.js";

// Logger decorators
export { logSerializer } from "./core/logger/decorators/logSerializer.js";
export { redactor } from "./core/logger/decorators/logRedactor.js";

// Template decorators
export { template } from "./modules/templates/decorators/template.js";
export { tag } from "./modules/templates/decorators/tag.js";

export type { Serializable, JsonValue } from "./core/types.js";

// Utils exports
export * as serialization from "./utils/serialization.js";
export * as async from "./utils/async.js";
export * as file from "./utils/file.js";
export * as recursion from "./utils/recursion.js";
export * as string from "./utils/string.js";

export type { MaybeAsync, MaybeOptionalAsync, Scalar } from "./core/types.js";

// Thunk utilities (top-level exports as they're commonly used)
export { thunk, resolve, Thunk } from "./utils/thunk.js";


export { toUniqueId, toUniqueIdAsync, toUniqueIds, toUniqueIdsAsync } from "./core/models/utils.js";

// Type exports
export type { BasePubSubArgs, Subscriber } from "./core/pubsub/types.js";
export type { BaseAppConfig, ConfigData } from "./core/config/types.js";
export type { Constructor, Instance, BaseDiWrapper } from "./core/di/types.js";

// Model types
export type { BaseModelClass } from "./core/models/baseModel.js";
export type { 
  ModelConstructor,
  ModelData,
  DefinedId,
  DefinedIds,
  AsyncDefinedId,
  AsyncDefinedIds,
  Cardinality,
  RelationType,
  ModelEventType,
  Persistable,
  Deletable,
  Countable,
  Slicable,
  RefOne,
  RefMany,
  EmbedOne,
  EmbedMany,
  EmbedMap,
  ModelMetadata,
  FieldMetadata,
  BaseModelSchema,
  ModelEvent,
  FieldOptions
} from "./core/models/types.js";

// Logger types
export type { 
  LogContext, 
  LogError, 
  SerializedLogMessage, 
  LoggerFunction, 
  LogFormatter,
  LogObjectTransformer,
  TypeSerializer,
  PatternMap
} from "./core/logger/types.js";

// Request handler types
export type { 
  BaseHttpActionArgs,
  BaseWebSocketUpgradeArgs,
  BaseWebSocketMessageArgs,
  BaseWebSocketCloseArgs,
  HttpContextData, 
  UrlParams, 
  RouteHandler, 
  RouteTarget, 
  Routes,
  CookieOptions,
  ParsedForm
} from "./core/requestHandler/types.js";

// Module types
export type { 
  BaseActionArgs, 
  ActionOptions, 
  BaseAction 
} from "./core/module/types.js";

// Template types
export type { 
  Templates, 
  TagFactories,
  TemplateTags,
  TemplateElements,
  TagFactory,
  TemplateFactory,
  TemplateFactories,
  TagConstructor,
  TemplateConstructor,
  SimpleTagConstructor,
  ElementFactory,
  ElementFunction,
  TemplateOrString,
  Optional
} from "./modules/templates/types.js";

// Template config
export { BaseTemplatesConfig } from "./modules/templates/types.js";
