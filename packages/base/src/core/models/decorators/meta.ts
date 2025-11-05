import { type ModelMetadata } from "../types.js";

/**
 * Decorator to set model-level metadata using the new unified metadata system.
 * 
 * @example
 * @meta('mongo', { collection: 'users' })
 * class User extends IBaseModel<User> { }
 */
export function meta<K extends keyof ModelMetadata>(key: K, value: ModelMetadata[K]) {
    return (target: unknown, _context: ClassDecoratorContext) => {
        // Use type assertion to access private static method
        (target as { setMetaValue: (key: K, value: ModelMetadata[K]) => void }).setMetaValue(key, value);
    };
}
