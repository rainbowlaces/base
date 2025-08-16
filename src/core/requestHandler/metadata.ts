// Lightweight action metadata registry to avoid polluting BaseAction interface
import { type BaseAction } from "../module/types.js";

interface ActionMetadata {
  timeout?: number;
}

const ACTION_META = new WeakMap<BaseAction, ActionMetadata>();

export function setActionMetadata(action: BaseAction, meta: ActionMetadata) {
  const existing = ACTION_META.get(action) || {};
  ACTION_META.set(action, { ...existing, ...meta });
}

export function getActionMetadata(action: BaseAction): ActionMetadata | undefined {
  return ACTION_META.get(action);
}
