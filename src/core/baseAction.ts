import BaseContext from "./baseContext";
import { BasePubSubArgs, Subscriber } from "./basePubSub";
import { BaseHttpContext } from "./requestHandler/httpContext";

export interface BaseHttpActionArgs extends BasePubSubArgs {
  context: BaseHttpContext;
}

export interface BaseActionArgs extends BasePubSubArgs {
  context: BaseContext;
}

export interface BaseAction extends Subscriber {
  (): Promise<void>;
  (args?: BaseActionArgs): Promise<void>;
  dependsOn?: string[];
  action: true;
  isGlobal: boolean;
  type: "request" | "init";
  name: string;
}
