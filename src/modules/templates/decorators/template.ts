import { registerDi } from '../../../core/di/decorators/registerDi';
import { type TemplateConstructor } from '../types';

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