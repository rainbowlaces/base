import { type ModelMetadata } from "../types.js";

/**
 * Decorator to set model-level metadata using the new unified metadata system.
 * 
 * @example
 * @meta('mongo', { collection: 'users' })
 * class User extends BaseModel<User> { }
 */
export function meta<K extends keyof ModelMetadata>(key: K, value: ModelMetadata[K]) {
    return (target: { setMetaValue: (key: K, value: ModelMetadata[K]) => void }, _context: ClassDecoratorContext) => {
        target.setMetaValue(key, value);
    };
}
