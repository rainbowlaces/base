import { type BaseContext } from "./baseContext";
import { type BasePubSubArgs, type Subscriber } from "./basePubSub";
import { type BaseHttpContext } from "./requestHandler/httpContext";

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
  type: "request" | "init";
  name: string;
}
