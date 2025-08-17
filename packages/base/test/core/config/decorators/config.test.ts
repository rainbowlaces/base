import { test } from 'node:test';
import * as assert from 'node:assert';
import { BaseConfigProvider, BaseConfigRegistry } from '../../../../src/core/config/baseConfigRegistry.js';
import { BaseDi } from '../../../../src/core/di/baseDi.js';
import { provider } from '../../../../src/core/config/decorators/provider.js';
import { BaseClassConfig } from '../../../../src/core/config/types.js';
import { configClass } from '../../../../src/core/config/decorators/configClass.js';
import { Thunk } from '../../../../src/utils/thunk.js';
import { ConfigClassRegistry } from '../../../../src/core/config/configClassRegistry.js';

// Extend BaseAppConfig for testing
declare module '../../../../src/core/config/types.js' {
  interface BaseAppConfig {
    test?: string;
    default?: string;
    production?: string;
    customValue?: string;
  }
}

test('@config decorator', (t) => {
  t.beforeEach(async () => {
    // Clean up before each test
    await BaseDi.teardown();
    // Clear the providers array
    ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers = [];
  });

  t.test('basic functionality', (t) => {
    t.test('should register provider with default parameters', () => {
      // Create a test config provider class
      @provider()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'value' };
        }
      }

      // Verify the provider was registered
      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      assert.strictEqual(providers.length, 1, 'Should register one provider');
      
      const configProvider = providers[0];
      assert.strictEqual(configProvider.env, 'default', 'Should use default environment');
      assert.strictEqual(configProvider.priority, 0, 'Should use priority 0 for default environment');
      assert.deepStrictEqual(configProvider.config, { test: 'value' }, 'Should have correct config');
    });

    t.test('should register provider with custom environment', () => {
      @provider('test')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'custom' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      assert.strictEqual(providers.length, 1, 'Should register one provider');
      
      const configProvider = providers[0];
      assert.strictEqual(configProvider.env, 'test', 'Should use custom environment');
      assert.strictEqual(configProvider.priority, 100, 'Should use priority 100 for non-default environment');
    });

    t.test('should register provider with custom priority', () => {
      @provider('production', 50)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'priority' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      assert.strictEqual(providers.length, 1, 'Should register one provider');
      
      const configProvider = providers[0];
      assert.strictEqual(configProvider.env, 'production', 'Should use custom environment');
      assert.strictEqual(configProvider.priority, 50, 'Should use custom priority');
    });

    t.test('should register provider with default environment and custom priority', () => {
      @provider('default', 25)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'default-custom' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      assert.strictEqual(providers.length, 1, 'Should register one provider');
      
      const configProvider = providers[0];
      assert.strictEqual(configProvider.env, 'default', 'Should use default environment');
      assert.strictEqual(configProvider.priority, 25, 'Should use custom priority even for default');
    });
  });

  t.test('edge cases', (t) => {
    t.test('should handle environment normalization', () => {
      @provider('PRODUCTION')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'uppercase' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      const configProvider = providers[0];
      assert.strictEqual(configProvider.env, 'production', 'Should convert environment to lowercase');
    });

    t.test('should handle undefined environment parameter', () => {
      @provider(undefined)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'undefined-env' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      const configProvider = providers[0];
      assert.strictEqual(configProvider.env, 'default', 'Should default to "default" for undefined environment');
      assert.strictEqual(configProvider.priority, 0, 'Should use priority 0 for default environment');
    });

    t.test('should handle zero priority correctly', () => {
      @provider('test', 0)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'zero-priority' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      const configProvider = providers[0];
      assert.strictEqual(configProvider.priority, 0, 'Should handle zero priority correctly');
    });

    t.test('should handle negative priority correctly', () => {
      @provider('test', -10)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'negative-priority' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      const configProvider = providers[0];
      assert.strictEqual(configProvider.priority, -10, 'Should handle negative priority correctly');
    });

    t.test('should register multiple providers correctly', () => {
      @provider('default')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class DefaultConfig extends BaseConfigProvider {
        get config() {
          return { default: 'value' };
        }
      }

      @provider('test', 50)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'value' };
        }
      }

      @provider('PRODUCTION', 25)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class ProductionConfig extends BaseConfigProvider {
        get config() {
          return { production: 'value' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      assert.strictEqual(providers.length, 3, 'Should register all three providers');

      // Verify each provider
      const defaultProvider = providers.find((p: BaseConfigProvider) => p.env === 'default');
      const testProvider = providers.find((p: BaseConfigProvider) => p.env === 'test');
      const productionProvider = providers.find((p: BaseConfigProvider) => p.env === 'production');

      assert.ok(defaultProvider, 'Should have default provider');
      assert.ok(testProvider, 'Should have test provider');
      assert.ok(productionProvider, 'Should have production provider');

      assert.strictEqual(defaultProvider.priority, 0, 'Default should have priority 0');
      assert.strictEqual(testProvider.priority, 50, 'Test should have priority 50');
      assert.strictEqual(productionProvider.priority, 25, 'Production should have priority 25');
    });
  });
});

test('@configClass decorator', (t) => {
  t.beforeEach(() => {
    // Clear the config class registry before each test
  ConfigClassRegistry.clear();
  });

  t.test('basic functionality', (t) => {
    t.test('should register class with correct namespace', () => {
      @configClass('test')
      class TestConfig extends BaseClassConfig {
        message: string = "test message";
      }

  const registeredClass = ConfigClassRegistry.get('test');
      assert.strictEqual(registeredClass, TestConfig, 'Should register class with correct namespace');
    });

    t.test('should return undefined for unregistered namespace', () => {
  const registeredClass = ConfigClassRegistry.get('nonexistent');
      assert.strictEqual(registeredClass, undefined, 'Should return undefined for unregistered namespace');
    });

    t.test('should register multiple classes', () => {
      @configClass('first')
      class FirstConfig extends BaseClassConfig {
        value: string = "first";
      }

      @configClass('second')
      class SecondConfig extends BaseClassConfig {
        value: string = "second";
      }

  const firstClass = ConfigClassRegistry.get('first');
  const secondClass = ConfigClassRegistry.get('second');
      
      assert.strictEqual(firstClass, FirstConfig, 'Should register first class');
      assert.strictEqual(secondClass, SecondConfig, 'Should register second class');
      assert.notStrictEqual(firstClass, secondClass, 'Should register different classes');
    });

    t.test('should handle duplicate registrations', () => {
      @configClass('duplicate')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class FirstConfig extends BaseClassConfig {
        value: string = "first";
      }

      @configClass('duplicate')
      class SecondConfig extends BaseClassConfig {
        value: string = "second";
      }

  const registeredClass = ConfigClassRegistry.get('duplicate');
      assert.strictEqual(registeredClass, SecondConfig, 'Should register the latest class for duplicate namespace');
    });

    t.test('should allow passing class constructor instead of string', () => {
      class DirectNamespace extends BaseClassConfig {
        value: string = 'ctor';
      }
      @configClass(DirectNamespace)
      class SomeConfig extends BaseClassConfig {
        x = 1;
      }
  const registered = ConfigClassRegistry.get('DirectNamespace');
      assert.strictEqual(registered, SomeConfig, 'Should register using class constructor name as namespace');
    });

    t.test('should allow passing Thunk of class constructor', () => {
      class ThunkNamespace extends BaseClassConfig {
        value: string = 'thunk';
      }
      const thunkInstance: Thunk<typeof ThunkNamespace> = new Thunk(() => ThunkNamespace);
      @configClass(thunkInstance)
      class ThunkedConfig extends BaseClassConfig {
        y = 2;
      }
  const registered = ConfigClassRegistry.get('ThunkNamespace');
      assert.strictEqual(registered, ThunkedConfig, 'Should register using resolved thunk class name as namespace');
    });
  });
});
