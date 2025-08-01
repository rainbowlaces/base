import { BaseClassConfig, type ConfigData } from '../../core/config/types.js';
import { type BaseTemplate } from './baseTemplate.js';
import type { Renderable } from './engine/renderable.js';
import { type Tag, type TagConfig } from './engine/tag.js';
import { type TemplateResult } from './engine/templateResult.js';

export type MaybeAsync<T> = T | Promise<T>;
export type Optional<T> = T | null | undefined;
export type TemplateOrString = MaybeAsync<string | Renderable>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TagConstructor<T = any, P extends TagConfig = TagConfig> = new (value?: T, config?: P) => Tag<T, P>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TemplateConstructor<T = any> = new (data: T) => BaseTemplate<T>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SimpleTagConstructor<T = any> = new (value?: T) => Tag;

/**
 * Registry of available template tags.
 * Modules can extend this using declaration merging.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TemplateTags {
  // Intentionally empty. Modules will add their tags here via declaration merging.
}

/**
 * Registry of available template elements.
 * Modules can extend this using declaration merging.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TemplateElements {
  // Intentionally empty. Modules will add their elements here via declaration merging.
}

/**
 * Factory function for creating template elements.
 */
export type ElementFactory = (data: unknown) => Renderable;

/**
 * Function for creating template elements (old pattern - may be deprecated).
 */
export type ElementFunction = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  tags?: TemplateTags,
  elements?: TemplateElements
) => Renderable;

export class BaseTemplatesConfig extends BaseClassConfig {
  /**
   * Maximum buffer size in megabytes before throwing buffer exceeded error.
   * Prevents runaway memory usage during template rendering.
   * Default: 8
   */
  bufferLimitMB: number = 8;

  /**
   * Whether to perform HTML validation on rendered output.
   * When true, strips dangerous attributes and neutralizes unsafe URL schemes.
   * Default: true
   */
  validateHtml: boolean = true;
}

// Declaration merging to add the templates config to the global app config type.
declare module "../../core/config/types.js" {
  interface BaseAppConfig {
    BaseTemplates?: ConfigData<BaseTemplatesConfig>;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TagFactory<T extends Tag<any, any>> = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: T extends Tag<infer V, any> ? V : unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: T extends Tag<any, infer P> ? P : Record<string, unknown>
) => T;

export type TagFactories = { [K in keyof TemplateTags]: TagFactory<TemplateTags[K]> };

/**
 * Registry of available template components.
 * Maps template names (strings) to their class instances for type safety.
 * Modules can extend this using declaration merging.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Templates {
  // Intentionally empty. Modules will add their templates here via declaration merging.
}

/**
 * A mapped type that creates a correctly typed factory function for a given
 * template component instance type `T`. It infers the data type `D` that the
 * component's constructor expects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TemplateFactory<T extends BaseTemplate<any>> =
    T extends BaseTemplate<infer D>
        ? (data: D) => TemplateResult
        : never;

/**
 * A map of template names to their corresponding, fully type-safe factory functions.
 */
export type TemplateFactories = {
    [K in keyof Templates]: TemplateFactory<Templates[K]>;
};


