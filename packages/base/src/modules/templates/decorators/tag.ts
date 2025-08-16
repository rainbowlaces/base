import { registerDi } from '../../../core/di/decorators/registerDi.js';
import { type SimpleTagConstructor, type TagConstructor } from '../types.js';
import { type Tag } from '../engine/tag.js';

export function tag() {
  return (target: TagConstructor | SimpleTagConstructor, context: ClassDecoratorContext) => {

    const tempInstance = new target() as Tag;
    const tagName = tempInstance.name;

    if (!tagName) {
      throw new Error(`Tag class ${String(context.name)} must have a name property`);
    }

    registerDi({
      key: `TemplateTag.${tagName}`,
      tags: ['Template:Tag'],
      singleton: false
    })(target, context);
  };
}