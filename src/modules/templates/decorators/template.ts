import { registerDi } from '../../../core/di/decorators/registerDi.js';
import { type TemplateConstructor } from '../types.js';

export function template() {
  return (target: TemplateConstructor, context: ClassDecoratorContext) => {

    const templateName = target.name;

    registerDi({
      key: `Template.${templateName}`,
      tags: ['Template'],
      singleton: false
    })(target, context);
  };
}