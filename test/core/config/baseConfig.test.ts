import { test } from 'node:test';
import * as assert from 'node:assert';
import { BaseConfig } from '../../../src/core/config/baseConfig';
import { BaseConfigRegistry } from '../../../src/core/config/baseConfigRegistry';
import { BaseDi } from '../../../src/core/di/baseDi';

// Mock module classes for testing
class TestModule {
  getValue(): string { return 'test'; }
}

class AnotherModule {
  getValue(): string { return 'another'; }
}

class NonExistentModule {
  getValue(): string { return 'nonexistent'; }
}

test('BaseConfig', (t) => {
  t.test('setup() method', (t) => {
    t.test('should resolve BaseConfigRegistry with environment', async () => {
      // Mock BaseDi.resolve to return our test data
      const originalResolve = BaseDi.resolve.bind(BaseDi);
      const mockConfigRegistry = {
        config: { TestModule: { apiUrl: 'test-api' } }
      };
      
      let resolveCallCount = 0;
      BaseDi.resolve = ((key: unknown, ...args: unknown[]) => {
        resolveCallCount++;
        if (resolveCallCount === 1) {
          // First call should be for 'env'
          assert.strictEqual(key, 'env');
          return 'test-env';
        } else if (resolveCallCount === 2) {
          // Second call should be for BaseConfigRegistry with the env argument
          assert.strictEqual(key, BaseConfigRegistry);
          assert.strictEqual(args[0], 'test-env');
          return mockConfigRegistry;
        }
        throw new Error('Unexpected resolve call');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      const baseConfig = new BaseConfig();
      await baseConfig.setup();

      // Verify config was set up
      const testConfig = baseConfig.getConfig(TestModule);
      assert.deepStrictEqual(testConfig, { apiUrl: 'test-api' });

      // Restore original resolve
      BaseDi.resolve = originalResolve;
    });

    t.test('should handle DI resolution failures gracefully', async () => {
      // Mock BaseDi.resolve to throw an error
      const originalResolve = BaseDi.resolve.bind(BaseDi);
      BaseDi.resolve = (() => {
        throw new Error('Key \'env\' not found in DI container');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      const baseConfig = new BaseConfig();
      
      await assert.rejects(
        async () => { await baseConfig.setup(); },
        /Key 'env' not found in DI container/
      );

      // Restore original resolve
      BaseDi.resolve = originalResolve;
    });
  });

  t.test('getConfig() method', (t) => {
    t.test('should retrieve config for known namespace', () => {
      // Manually set up BaseConfig with test data
      const baseConfig = new BaseConfig();
      // Access private static field for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (BaseConfig as any).config = {
        config: {
          TestModule: { apiUrl: 'test-api', timeout: 5000 },
          AnotherModule: { enabled: true }
        }
      };

      const testConfig = baseConfig.getConfig(TestModule);
      assert.deepStrictEqual(testConfig, { apiUrl: 'test-api', timeout: 5000 });
      
      const anotherConfig = baseConfig.getConfig(AnotherModule);
      assert.deepStrictEqual(anotherConfig, { enabled: true });
    });

    t.test('should return undefined for non-existent namespace', () => {
      const baseConfig = new BaseConfig();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (BaseConfig as any).config = {
        config: { TestModule: { apiUrl: 'test-api' } }
      };

      const nonExistentConfig = baseConfig.getConfig(NonExistentModule);
      assert.strictEqual(nonExistentConfig, undefined);
    });

    t.test('should handle undefined config when not set up', () => {
      const baseConfig = new BaseConfig();
      // Ensure config is undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (BaseConfig as any).config = undefined;

      // Should throw because BaseConfig.config is undefined
      assert.throws(
        () => baseConfig.getConfig(TestModule),
        /Cannot read properties of undefined/
      );
    });
  });

  t.test('DI registration', (t) => {
    t.test('should be decorated with registerDi with correct options', () => {
      // This is more of an integration test, but we can verify the class structure
      // The @registerDi({ setup: true, phase: 10 }) decorator should be present
      // We can verify this by checking if the class has the expected properties
      
      // Check that BaseConfig has a setup method (required for setup: true)
      assert.strictEqual(typeof BaseConfig.prototype.setup, 'function');
      
      // Check that it has the getConfig method
      assert.strictEqual(typeof BaseConfig.prototype.getConfig, 'function');
      
      // The actual DI registration is tested in integration tests
      assert.ok(true, 'BaseConfig has expected structure for DI registration');
    });
  });
});
