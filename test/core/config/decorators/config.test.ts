import { test } from 'node:test';
import * as assert from 'node:assert';
import { config } from '../../../../src/core/config/decorators/config';
import { BaseConfigProvider, BaseConfigRegistry } from '../../../../src/core/config/baseConfigRegistry';
import { BaseDi } from '../../../../src/core/di/baseDi';

// Extend BaseAppConfig for testing
declare module '../../../../src/core/config/types' {
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
      @config()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'value' };
        }
      }

      // Verify the provider was registered
      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      assert.strictEqual(providers.length, 1, 'Should register one provider');
      
      const provider = providers[0];
      assert.strictEqual(provider.env, 'default', 'Should use default environment');
      assert.strictEqual(provider.priority, 0, 'Should use priority 0 for default environment');
      assert.deepStrictEqual(provider.config, { test: 'value' }, 'Should have correct config');
    });

    t.test('should register provider with custom environment', () => {
      @config('test')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'custom' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      assert.strictEqual(providers.length, 1, 'Should register one provider');
      
      const provider = providers[0];
      assert.strictEqual(provider.env, 'test', 'Should use custom environment');
      assert.strictEqual(provider.priority, 100, 'Should use priority 100 for non-default environment');
    });

    t.test('should register provider with custom priority', () => {
      @config('production', 50)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'priority' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      assert.strictEqual(providers.length, 1, 'Should register one provider');
      
      const provider = providers[0];
      assert.strictEqual(provider.env, 'production', 'Should use custom environment');
      assert.strictEqual(provider.priority, 50, 'Should use custom priority');
    });

    t.test('should register provider with default environment and custom priority', () => {
      @config('default', 25)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'default-custom' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      assert.strictEqual(providers.length, 1, 'Should register one provider');
      
      const provider = providers[0];
      assert.strictEqual(provider.env, 'default', 'Should use default environment');
      assert.strictEqual(provider.priority, 25, 'Should use custom priority even for default');
    });
  });

  t.test('edge cases', (t) => {
    t.test('should handle environment normalization', () => {
      @config('PRODUCTION')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'uppercase' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      const provider = providers[0];
      assert.strictEqual(provider.env, 'production', 'Should convert environment to lowercase');
    });

    t.test('should handle undefined environment parameter', () => {
      @config(undefined)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'undefined-env' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      const provider = providers[0];
      assert.strictEqual(provider.env, 'default', 'Should default to "default" for undefined environment');
      assert.strictEqual(provider.priority, 0, 'Should use priority 0 for default environment');
    });

    t.test('should handle zero priority correctly', () => {
      @config('test', 0)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'zero-priority' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      const provider = providers[0];
      assert.strictEqual(provider.priority, 0, 'Should handle zero priority correctly');
    });

    t.test('should handle negative priority correctly', () => {
      @config('test', -10)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'negative-priority' };
        }
      }

      const providers = ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers;
      const provider = providers[0];
      assert.strictEqual(provider.priority, -10, 'Should handle negative priority correctly');
    });

    t.test('should register multiple providers correctly', () => {
      @config('default')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class DefaultConfig extends BaseConfigProvider {
        get config() {
          return { default: 'value' };
        }
      }

      @config('test', 50)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestConfig extends BaseConfigProvider {
        get config() {
          return { test: 'value' };
        }
      }

      @config('PRODUCTION', 25)
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
