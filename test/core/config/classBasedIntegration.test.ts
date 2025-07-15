import { test } from 'node:test';
import * as assert from 'node:assert';
import { BaseClassConfig } from '../../../src/core/config/types.js';
import { configClass, clearConfigClassRegistry } from '../../../src/core/config/decorators/provider.js';
import { BaseConfigRegistry, BaseConfigProvider } from '../../../src/core/config/baseConfigRegistry.js';
import { BaseDi } from '../../../src/core/di/baseDi.js';

// Extend BaseAppConfig for testing
declare module '../../../src/core/config/types.js' {
  interface BaseAppConfig {
    IntegrationTestModule?: {
      message?: string;
      enabled?: boolean;
      retries?: number;
    };
    UnknownIntegrationModule?: {
      someValue?: string;
    };
    IntegrationModuleA?: {
      nameA?: string;
      valueA?: number;
    };
    IntegrationModuleB?: {
      nameB?: string;
      valueB?: boolean;
    };
  }
}

test('Class-based Configuration Integration', (t) => {
  t.beforeEach(async () => {
    await BaseDi.teardown();
    BaseConfigRegistry.clearProviders();
    clearConfigClassRegistry();
  });

  t.test('should work with class-based config in module pattern', () => {
    // Define a class-based config like a real module would
    @configClass('IntegrationTestModule')
    class IntegrationTestModuleConfig extends BaseClassConfig {
      message: string = 'Default message';
      enabled: boolean = true;
      retries: number = 3;
    }

    // Create a provider that provides config data
    class TestConfigProvider extends BaseConfigProvider {
      get config() {
        return {
          IntegrationTestModule: {
            message: 'Hello from provider!',
            retries: 5
            // enabled is not provided, should use default
          }
        };
      }
    }

    // Register the provider
    BaseConfigRegistry.register(new TestConfigProvider());

    // Mock BaseDi.register to capture what gets registered
    const registrations: any[] = [];
    const originalRegister = BaseDi.register.bind(BaseDi);
    BaseDi.register = (value: any, options: any) => {
      registrations.push({ value, options });
       
      originalRegister(value, options);
    };

    try {
      // Create registry - this should instantiate the class and hydrate it
      new BaseConfigRegistry('default');

      // Find the registration for our config
      const testModuleReg = registrations.find(r => 
        typeof r.options === 'object' && 'key' in r.options && r.options.key === 'Config.IntegrationTestModule'
      );

      assert.ok(testModuleReg, 'Should register IntegrationTestModule config');
      assert.ok(testModuleReg.value instanceof IntegrationTestModuleConfig, 'Should be a class instance');

      // Verify hydration worked correctly
      const config = testModuleReg.value as IntegrationTestModuleConfig;
      assert.strictEqual(config.message, 'Hello from provider!', 'Should hydrate provided values');
      assert.strictEqual(config.retries, 5, 'Should hydrate provided values');
      assert.strictEqual(config.enabled, true, 'Should preserve default values for non-provided properties');

      // Verify it has the hydrate method
      assert.strictEqual(typeof config.hydrate, 'function', 'Should have hydrate method');

    } finally {
      BaseDi.register = originalRegister;
    }
  });

  t.test('should fall back to scalar registration for non-decorated configs', () => {
    // Create a provider with a namespace that doesn't have @configClass
    class TestConfigProvider extends BaseConfigProvider {
      get config() {
        return {
          UnknownIntegrationModule: {
            someValue: 'scalar config'
          }
        };
      }
    }

    BaseConfigRegistry.register(new TestConfigProvider());

    // Mock BaseDi.register to capture what gets registered
    const registrations: any[] = [];
    const originalRegister = BaseDi.register.bind(BaseDi);
    BaseDi.register = (value: any, options: any) => {
      registrations.push({ value, options });
       
      originalRegister(value, options);
    };

    try {
      new BaseConfigRegistry('default');

      const unknownModuleReg = registrations.find(r => 
        typeof r.options === 'object' && 'key' in r.options && r.options.key === 'Config.UnknownIntegrationModule'
      );

      assert.ok(unknownModuleReg, 'Should register UnknownIntegrationModule config');
      assert.strictEqual(typeof unknownModuleReg.value, 'object', 'Should be a plain object');
      assert.ok(!(unknownModuleReg.value instanceof BaseClassConfig), 'Should not be a class instance');
      assert.deepStrictEqual(unknownModuleReg.value, { someValue: 'scalar config' }, 'Should be the raw config data');

    } finally {
      BaseDi.register = originalRegister;
    }
  });

  t.test('should support multiple class-based configs', () => {
    // Define multiple config classes
    @configClass('IntegrationModuleA')
    class IntegrationModuleAConfig extends BaseClassConfig {
      nameA: string = 'Default A';
      valueA: number = 10;
    }

    @configClass('IntegrationModuleB')
    class IntegrationModuleBConfig extends BaseClassConfig {
      nameB: string = 'Default B';
      valueB: boolean = false;
    }

    // Provider for both modules
    class MultiConfigProvider extends BaseConfigProvider {
      get config() {
        return {
          IntegrationModuleA: { nameA: 'Configured A' },
          IntegrationModuleB: { valueB: true }
        };
      }
    }

    BaseConfigRegistry.register(new MultiConfigProvider());

    const registrations: any[] = [];
    const originalRegister = BaseDi.register.bind(BaseDi);
    BaseDi.register = (value: any, options: any) => {
      registrations.push({ value, options });
       
      originalRegister(value, options);
    };

    try {
      new BaseConfigRegistry('default');

      const moduleAReg = registrations.find(r => 
        typeof r.options === 'object' && 'key' in r.options && r.options.key === 'Config.IntegrationModuleA'
      );
      const moduleBReg = registrations.find(r => 
        typeof r.options === 'object' && 'key' in r.options && r.options.key === 'Config.IntegrationModuleB'
      );

      // Verify both are registered as class instances
      assert.ok(moduleAReg && moduleAReg.value instanceof IntegrationModuleAConfig, 'IntegrationModuleA should be class instance');
      assert.ok(moduleBReg && moduleBReg.value instanceof IntegrationModuleBConfig, 'IntegrationModuleB should be class instance');

      // Verify configuration
      const configA = moduleAReg.value as IntegrationModuleAConfig;
      const configB = moduleBReg.value as IntegrationModuleBConfig;

      assert.strictEqual(configA.nameA, 'Configured A', 'IntegrationModuleA should have configured value');
      assert.strictEqual(configA.valueA, 10, 'IntegrationModuleA should have default value');
      
      assert.strictEqual(configB.nameB, 'Default B', 'IntegrationModuleB should have default value');
      assert.strictEqual(configB.valueB, true, 'IntegrationModuleB should have configured value');

    } finally {
      BaseDi.register = originalRegister;
    }
  });
});
