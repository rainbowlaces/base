import { test } from 'node:test';
import * as assert from 'node:assert';
import { BaseConfigRegistry, BaseConfigProvider } from '../../../src/core/config/baseConfigRegistry.js';
import { BaseDi } from '../../../src/core/di/baseDi.js';
import { BaseClassConfig, configClass, clearConfigClassRegistry } from '../../../src/index.js';

// Extend BaseAppConfig for testing
declare module '../../../src/core/config/types.js' {
  interface BaseAppConfig {
    TestModule?: {
      value?: string;
      priority?: string;
      defaultValue?: string;
      testValue?: string;
      prodValue?: string;
      api?: {
        url?: string;
        timeout?: number;
        retries?: number;
      };
      features?: {
        feature1?: boolean;
        feature2?: boolean;
      };
    };
    Module1?: {
      value?: string;
      setting1?: string;
    };
    Module2?: {
      value?: string;
      setting2?: string;
    };
  }
}

test('BaseConfigRegistry', (t) => {
  t.beforeEach(async () => {
    // Clean up before each test
    await BaseDi.teardown();
    // Clear the static providers array
    BaseConfigRegistry.clearProviders();
  });

  t.test('BaseConfigProvider abstract class', (t) => {
    t.test('should create with default parameters', () => {
      class TestProvider extends BaseConfigProvider {
        get config() {
          return { TestModule: { value: 'test' } };
        }
      }
      
      const provider = new TestProvider();
      assert.strictEqual(provider.env, 'default');
      assert.strictEqual(provider.priority, 0);
    });

    t.test('should create with custom parameters', () => {
      class TestProvider extends BaseConfigProvider {
        get config() {
          return { TestModule: { value: 'test' } };
        }
      }
      
      const provider = new TestProvider('production', 100);
      assert.strictEqual(provider.env, 'production');
      assert.strictEqual(provider.priority, 100);
    });

    t.test('should require config getter implementation', () => {
      // This is enforced by TypeScript, but we can verify the abstract nature
      class TestProvider extends BaseConfigProvider {
        get config() {
          return { TestModule: { value: 'test' } };
        }
      }
      
      const provider = new TestProvider();
      assert.strictEqual(typeof provider.config, 'object');
      assert.ok('TestModule' in provider.config);
    });
  });

  t.test('register() static method', (t) => {
    t.test('should add provider to internal array', () => {
      class TestProvider extends BaseConfigProvider {
        get config() {
          return { TestModule: { value: 'test' } };
        }
      }
      
      const provider = new TestProvider('test', 50);
      BaseConfigRegistry.register(provider);
      
      // Access providers array to verify registration
      const providers = BaseConfigRegistry.getProviders();
      assert.strictEqual(providers.length, 1);
      assert.strictEqual(providers[0], provider);
    });

    t.test('should register multiple providers', () => {
      class TestProvider1 extends BaseConfigProvider {
        get config() {
          return { Module1: { value: 'test1' } };
        }
      }
      
      class TestProvider2 extends BaseConfigProvider {
        get config() {
          return { Module2: { value: 'test2' } };
        }
      }
      
      const provider1 = new TestProvider1('test', 10);
      const provider2 = new TestProvider2('prod', 20);
      
      BaseConfigRegistry.register(provider1);
      BaseConfigRegistry.register(provider2);
      
      const providers = BaseConfigRegistry.getProviders();
      assert.strictEqual(providers.length, 2);
      assert.strictEqual(providers[0], provider1);
      assert.strictEqual(providers[1], provider2);
    });
  });

  t.test('constructor and merging logic', (t) => {
    t.test('should filter providers by environment', () => {
      class DefaultProvider extends BaseConfigProvider {
        constructor() {
          super('default', 0);
        }
        get config() {
          return { TestModule: { defaultValue: 'default' } };
        }
      }
      
      class TestProvider extends BaseConfigProvider {
        constructor() {
          super('test', 10);
        }
        get config() {
          return { TestModule: { testValue: 'test' } };
        }
      }
      
      class ProdProvider extends BaseConfigProvider {
        constructor() {
          super('production', 20);
        }
        get config() {
          return { TestModule: { prodValue: 'prod' } };
        }
      }
      
      // Register all providers
      BaseConfigRegistry.register(new DefaultProvider());
      BaseConfigRegistry.register(new TestProvider());
      BaseConfigRegistry.register(new ProdProvider());
      
      // Create registry for 'test' environment - should include 'default' and 'test' only
      const registry = new BaseConfigRegistry('test');
      
      // Should have merged default and test configs
      assert.deepStrictEqual(registry.config.TestModule, {
        defaultValue: 'default',
        testValue: 'test'
      });
      
      // Should not have production config
      assert.ok(!('prodValue' in registry.config.TestModule));
    });

    t.test('should sort providers by priority (lower priority first)', () => {
      class LowPriorityProvider extends BaseConfigProvider {
        constructor() {
          super('test', 10);
        }
        get config() {
          return { TestModule: { value: 'low', priority: 'low' } };
        }
      }
      
      class HighPriorityProvider extends BaseConfigProvider {
        constructor() {
          super('test', 5);  // Lower number = higher priority
        }
        get config() {
          return { TestModule: { value: 'high', priority: 'high' } };
        }
      }
      
      // Register in reverse priority order
      BaseConfigRegistry.register(new LowPriorityProvider());
      BaseConfigRegistry.register(new HighPriorityProvider());
      
      const registry = new BaseConfigRegistry('test');
      
      // High priority should overwrite low priority
      assert.ok(registry.config.TestModule);
      assert.strictEqual(registry.config.TestModule.value, 'low');  // Lower priority number wins
      assert.strictEqual(registry.config.TestModule.priority, 'low');
    });

    t.test('should handle deep merging of nested objects', () => {
      class Provider1 extends BaseConfigProvider {
        constructor() {
          super('test', 10);
        }
        get config() {
          return {
            TestModule: {
              api: {
                url: 'http://api.test.com',
                timeout: 5000
              },
              features: {
                feature1: true
              }
            }
          };
        }
      }
      
      class Provider2 extends BaseConfigProvider {
        constructor() {
          super('test', 20);
        }
        get config() {
          return {
            TestModule: {
              api: {
                timeout: 3000,  // Should override
                retries: 3      // Should add
              },
              features: {
                feature2: false  // Should add
              }
            }
          };
        }
      }
      
      BaseConfigRegistry.register(new Provider1());
      BaseConfigRegistry.register(new Provider2());
      
      const registry = new BaseConfigRegistry('test');
      
      assert.deepStrictEqual(registry.config.TestModule, {
        api: {
          url: 'http://api.test.com',  // From provider1
          timeout: 3000,              // Overridden by provider2
          retries: 3                  // Added by provider2
        },
        features: {
          feature1: true,             // From provider1
          feature2: false             // Added by provider2
        }
      });
    });
  });

  t.test('DI registration for config namespaces', (t) => {
    t.test('should register each namespace with DI container', () => {
      // Clear any existing config class registrations
      clearConfigClassRegistry();
      
      // Mock BaseDi.register to capture registrations
      const originalRegister = BaseDi.register.bind(BaseDi);
      const registrations: { value: unknown; options: string | Partial<import('../../../src/core/di/types.js').BaseDiWrapper<unknown>> | undefined }[] = [];
      
      BaseDi.register = (value: unknown, options?: string | Partial<import('../../../src/core/di/types.js').BaseDiWrapper<unknown>>) => {
        registrations.push({ value, options });
        originalRegister(value, options);
      };
      
      class TestProvider extends BaseConfigProvider {
        constructor() {
          super('test', 0);
        }
        get config() {
          return {
            Module1: { setting1: 'value1' },
            Module2: { setting2: 'value2' }
          };
        }
      }
      
      BaseConfigRegistry.register(new TestProvider());
      
      // Create registry - this should trigger DI registrations
      new BaseConfigRegistry('test');
      
      // Should have registered 2 config objects
      assert.strictEqual(registrations.length, 2);
      
      // Check Module1 registration
      const module1Registration = registrations.find(r => 
        typeof r.options === 'object' && 'key' in r.options && r.options.key === 'Config.Module1'
      );
      assert.ok(module1Registration);
      assert.deepStrictEqual(module1Registration.value, { setting1: 'value1' });
      if (typeof module1Registration.options === 'object') {
        assert.strictEqual(module1Registration.options.singleton, true);
        assert.strictEqual(module1Registration.options.type, 'scalar');
      }
      
      // Check Module2 registration
      const module2Registration = registrations.find(r => 
        typeof r.options === 'object' && 'key' in r.options && r.options.key === 'Config.Module2'
      );
      assert.ok(module2Registration);
      assert.deepStrictEqual(module2Registration.value, { setting2: 'value2' });
      if (typeof module2Registration.options === 'object') {
        assert.strictEqual(module2Registration.options.singleton, true);
        assert.strictEqual(module2Registration.options.type, 'scalar');
      }
      
      // Restore original register
      BaseDi.register = originalRegister;
    });
  });

  t.test('class instantiation', (t) => {
    t.beforeEach(() => {
      // Clear the config class registry before each test
      clearConfigClassRegistry();
    });

    t.test('should create class instance when @configClass exists', () => {
      // Register a config class
      @configClass('TestModule')
      class TestModuleConfig extends BaseClassConfig {
        value: string = 'default value';
        priority: string = 'low';
      }

      // Create a provider that would normally provide data for TestModule
      class TestProvider extends BaseConfigProvider {
        get config() {
          return { TestModule: { value: 'provider value' } };
        }
      }

      // Register the provider
      BaseConfigRegistry.register(new TestProvider());

      // Mock BaseDi.register to capture what gets registered
      const registrations: any[] = [];
      const originalRegister = BaseDi.register.bind(BaseDi);
      BaseDi.register = (value: any, options: any) => {
        registrations.push({ value, options });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        originalRegister(value, options);
      };

      try {
        // Create registry which should create class instances
        new BaseConfigRegistry('default');

        // Find the TestModule registration
        const testModuleRegistration = registrations.find(r => 
          typeof r.options === 'object' && 'key' in r.options && r.options.key === 'Config.TestModule'
        );
        
        assert.ok(testModuleRegistration, 'Should register TestModule config');
        
        // Should be a class instance, not just a plain object
        assert.ok(testModuleRegistration.value instanceof TestModuleConfig, 'Should register class instance');
        
        // Should have hydrated values from provider
        assert.strictEqual(testModuleRegistration.value.value, 'provider value', 'Should hydrate with provider data');
        
        // Should preserve default values for non-provided properties
        assert.strictEqual(testModuleRegistration.value.priority, 'low', 'Should preserve default values');
        
      } finally {
        // Restore original register
        BaseDi.register = originalRegister;
      }
    });
  });
});
