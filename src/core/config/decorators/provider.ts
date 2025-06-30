import { type BaseConfigProvider, BaseConfigRegistry } from "../baseConfigRegistry";

// Class decorator for configuration providers
export function provider(environment?: string, priority?: number) {
  const env = environment?.toLowerCase() ?? 'default';
  const pri = priority ?? (env === 'default' ? 0 : 100);

  return function (target: new (env: string, pri: number) => BaseConfigProvider, _context: ClassDecoratorContext) {
    const provider = new target(env, pri);
    BaseConfigRegistry.register(provider);
  };
}
