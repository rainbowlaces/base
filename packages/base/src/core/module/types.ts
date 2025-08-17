import { type BasePubSubArgs, type Subscriber } from "../pubsub/types.js";
import { type BaseContext } from "./baseContext.js";

export interface BaseActionArgs extends BasePubSubArgs {
  context: BaseContext;
}

export interface ActionOptions {
  phase?: number;
  topic?: string;
  middleware?: boolean;
  /** @internal Allow phases below public minimum (50). Not for external use. */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _internal?: boolean;
}

export interface BaseAction extends Subscriber {
  (args?: BaseActionArgs): Promise<void>;
  dependsOn?: string[];
  action: true;
  phase: number;
  module: string;
  name: string;
  topic: string;
  middleware: boolean;
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
