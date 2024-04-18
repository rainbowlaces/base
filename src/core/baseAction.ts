import BaseContext from "./requestHandler/baseContext";
import { Subscriber } from "./basePubSub";

export interface BaseActionArgs {
  context?: BaseContext;
  [key: string]: unknown;
}

export interface BaseAction extends Subscriber {
  (args?: BaseActionArgs): Promise<void>;
  dependsOn?: string[];
  isGlobal?: boolean;
}
