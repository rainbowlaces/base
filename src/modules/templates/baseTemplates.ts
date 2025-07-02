import { baseModule } from "../../core/module/decorators/baseModule";
import { BaseModule } from "../../core/module/baseModule";
import { BaseDi } from '../../core/di/baseDi';
import { type Tag } from './engine/tag';
import { type TagFactories, type BaseTemplatesConfig, type TemplateFactories } from "./types";
import { type BaseTemplate } from "./baseTemplate";
import { type TemplateResult } from "./engine/templateResult";

@baseModule
export class BaseTemplates extends BaseModule<BaseTemplatesConfig> {

  public tagFactories: TagFactories = {} as TagFactories;
  public templateFactories: TemplateFactories = {} as TemplateFactories;

  async setup(): Promise<void> {
    this.logger.info('Building template tag factories from DI registry...');
    const tagInstances = BaseDi.resolveByTag<Tag>('Template:Tag');

    for (const instance of tagInstances) {
        const tagName = instance.name;
        const diKey = `TemplateTag.${tagName}`;
        const factory = (value: unknown, params: Record<string, unknown>) => {
            return BaseDi.resolve<Tag>(diKey, value, params);
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        this.tagFactories[tagName as keyof TagFactories] = factory as any;
        this.logger.debug(`Registered tag '${tagName}'...`);
    }
    this.logger.info(`Successfully built ${Object.keys(this.tagFactories).length} tag factories.`);

    // --- Build Template Factories (New Logic) ---
    this.logger.info('Building template component factories from DI registry...');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templateInstances = BaseDi.resolveByTag<BaseTemplate<any>>('Template');

    for (const instance of templateInstances) {
        const templateName = instance.constructor.name;
        const diKey = `Template.${templateName}`;

        const factory = (data: unknown): TemplateResult => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const templateInstance = BaseDi.resolve<BaseTemplate<any>>(diKey, data);
            return templateInstance.render();
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        this.templateFactories[templateName as keyof TemplateFactories] = factory as any;
        this.logger.debug(`Registered template component '${templateName}'...`);
    }
    this.logger.info(`Successfully built ${Object.keys(this.templateFactories).length} template factories.`);
  }

  async teardown(): Promise<void> {
    this.logger.info('BaseTemplates module shutdown');
  }
}