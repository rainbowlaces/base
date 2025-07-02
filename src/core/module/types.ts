import { type BasePubSubArgs, type Subscriber } from "../pubsub/types";
import { type BaseHttpContext } from "../requestHandler/httpContext";
import { type BaseContext } from "./baseContext";

export interface BaseHttpActionArgs extends BasePubSubArgs {
  context: BaseHttpContext;
}

export interface BaseActionArgs extends BasePubSubArgs {
  context: BaseContext;
}

export interface ActionOptions {
  phase?: number;
  topic?: string;
}

export interface BaseAction extends Subscriber {
  (args?: BaseActionArgs): Promise<void>;
  dependsOn?: string[];
  action: true;
  phase: number;
  module: string;
  name: string;
  topic: string;
}

export type TopicFunction = (
  id: string,
  module: string,
  action: string,
  status: string,
) => string;

export type ContextState = "pending" | "running" | "done" | "error";

export interface ModuleStatusArgs extends BasePubSubArgs {
  module: string;
  action: string;
  status: "error" | "done";
}
