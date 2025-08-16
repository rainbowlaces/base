// Request-layer augmentation of core ActionOptions to add timeout without polluting core types
import "../../core/module/types.js";

declare module "../../core/module/types.js" {
  interface ActionOptions {
    /** Optional per-action request timeout (ms) */
    timeout?: number;
  }
}
