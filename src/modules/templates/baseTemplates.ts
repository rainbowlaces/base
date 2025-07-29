import { BaseModule } from "../../core/module/baseModule.js";
import { BaseDi } from "../../core/di/baseDi.js";
import { type Tag } from "./engine/tag.js";
import {
  type TagFactories,
  type BaseTemplatesConfig,
  type TemplateFactories,
} from "./types.js";
import { type BaseTemplate } from "./baseTemplate.js";
import { type TemplateResult } from "./engine/templateResult.js";
import { BaseError } from "../../core/baseErrors.js";
import { registerDi } from "../../core/di/decorators/registerDi.js";

@registerDi({setup: true, singleton: true, phase: 30, tags: ["Module"]})
export class BaseTemplates extends BaseModule<BaseTemplatesConfig> {
  public tagFactories: TagFactories = {} as TagFactories;
  public templateFactories: TemplateFactories = {} as TemplateFactories;

  /**
   * Renders a registered template component with the given data.
   *
   * This method provides a type-safe way to render templates. The required `data`
   * type is inferred from the specified `templateClass`.
   *
   * @example
   * // Assuming 'ErrorTemplate' is registered and expects an `Error` object.
   * const result = templates.render(ErrorTemplate, new Error('Something went wrong'));
   *
   * @param templateClass The class constructor of the template to render.
   * @param data The data object required by the template's constructor.
   * @returns A Promise<string>
   * @throws {Error} If the template class is not registered.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async render<T extends new (...args: any) => BaseTemplate<any>>(
    templateClass: T,
    data: ConstructorParameters<T>[0]
  ): Promise<string> {
    const templateName = templateClass.name;
    const factory =
      this.templateFactories[templateName as keyof TemplateFactories];

    this.logger.debug(`Rendering template '${templateName}' with data:`, [], {
      data,
    });

     
    if (!factory) {
      const errorMessage = `Template '${templateName}' is not registered. Did you forget the @template decorator or to merge the type declaration?`;
      const e = new BaseError(errorMessage);
      this.logger.error(e);
      throw e;
    }

    const templateResult = factory(data);

    this.logger.debug(`Found template factory for '${templateName}'`, [], {
      templateResult,
    });

    return templateResult.render();
  }

  async setup(): Promise<void> {
    this.logger.info("Building template tag factories from DI registry...");
    const tagInstances = BaseDi.resolveByTag<Tag>("Template:Tag");

    for (const instance of tagInstances) {
      const tagName = instance.name;
      const diKey = `TemplateTag.${tagName}`;
      const factory = (value: unknown, params: Record<string, unknown>) => {
        return BaseDi.resolve<Tag>(diKey, value, params);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.tagFactories[tagName as keyof TagFactories] = factory as any;
      this.logger.debug(`Registered tag '${tagName}'...`);
    }
    this.logger.info(
      `Successfully built ${Object.keys(this.tagFactories).length} tag factories.`
    );

    // --- Build Template Factories (New Logic) ---
    this.logger.info(
      "Building template component factories from DI registry..."
    );

    const templateInstances =
      BaseDi.resolveByTag<BaseTemplate<never>>("Template");

    for (const instance of templateInstances) {
      const templateName = instance.constructor.name;
      const diKey = `Template.${templateName}`;

      const factory = (data: unknown): TemplateResult => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const templateInstance = BaseDi.resolve<BaseTemplate<any>>(diKey, data);
        return templateInstance.render();
      };

       
      this.templateFactories[templateName as keyof TemplateFactories] =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        factory as any;
      this.logger.info(`Registered template component '${templateName}'...`);
    }
    this.logger.info(
      `Successfully built ${Object.keys(this.templateFactories).length} template factories.`
    );
  }
}
