 
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { test } from "node:test";
import assert from "node:assert";
import { BaseConfig } from "../../../src/core/config/baseConfig.js";
import { BaseConfigRegistry, BaseConfigProvider } from "../../../src/core/config/baseConfigRegistry.js";
import { provider } from "../../../src/core/config/decorators/provider.js";
import { BaseDi } from "../../../src/core/di/baseDi.js";
import { BaseInitializer } from "../../../src/core/di/baseInitializer.js";
import { registerDi } from "../../../src/core/di/decorators/registerDi.js";
import { di } from "../../../src/core/di/decorators/di.js";

// Extend BaseAppConfig for testing
declare module '../../../src/core/config/types.js' {
  interface BaseAppConfig {
    database?: {
      host?: string;
      port?: number;
      name?: string;
      ssl?: boolean;
    };
    api?: {
      baseUrl?: string;
      timeout?: number;
      retries?: number;
    };
    logging?: {
      level?: string;
      format?: string;
    };
    features?: {
      enableFeatureA?: boolean;
      enableFeatureB?: boolean;
    };
  }
}

test("Config System Integration Tests", (t) => {
  t.beforeEach(async () => {
    await BaseDi.teardown();
    BaseInitializer.clear();
    // Clear providers array
    ((BaseConfigRegistry as unknown) as { providers: BaseConfigProvider[] }).providers = [];
    
    // Manually register services since they have decorators
    // In real apps this would happen automatically during module loading
    BaseDi.register(BaseConfig, { singleton: true, phase: 10 });
    BaseInitializer.register('BaseConfig', 10);
    BaseDi.register(BaseConfigRegistry);
  });

  t.test("Complete Configuration Lifecycle", (t) => {
    t.test("should handle end-to-end configuration flow", async () => {
      // Step 1: Create config providers with decorators
      @provider('default')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class DefaultDatabaseConfig extends BaseConfigProvider {
        get config() {
          return {
            database: {
              host: 'localhost',
              port: 5432,
              ssl: false
            },
            logging: {
              level: 'info'
            }
          };
        }
      }

      @provider('production')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class ProductionDatabaseConfig extends BaseConfigProvider {
        get config() {
          return {
            database: {
              host: 'prod-db.example.com',
              ssl: true
            },
            logging: {
              level: 'warn'
            }
          };
        }
      }

      @provider('test', 50)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestApiConfig extends BaseConfigProvider {
        get config() {
          return {
            api: {
              baseUrl: 'http://test.api.example.com',
              timeout: 5000
            }
          };
        }
      }

      // Step 2: Register environment
      BaseDi.register('production', { key: 'env' });

      // Step 3: Initialize the system (BaseConfig.setup will be called)
      await BaseInitializer.run();

      // Step 4: Verify merged configuration is available through DI
      const databaseConfig = BaseDi.resolve('Config.database') as unknown;
      let apiConfig: unknown;
      try {
        apiConfig = BaseDi.resolve('Config.api') as unknown;
      } catch {
        apiConfig = undefined; // Expected for production environment
      }
      const loggingConfig = BaseDi.resolve('Config.logging') as unknown;

      // Verify database config merging (production overrides default)
      assert.ok(databaseConfig, 'Database config should exist');
      assert.strictEqual((databaseConfig as any).host, 'prod-db.example.com', 'Should use production host');
      assert.strictEqual((databaseConfig as any).port, 5432, 'Should inherit default port');
      assert.strictEqual((databaseConfig as any).ssl, true, 'Should use production SSL setting');

      // Verify api config (only test config, but production env shouldn't include it)
      assert.strictEqual(apiConfig, undefined, 'API config should not be available in production');

      // Verify logging config
      assert.ok(loggingConfig, 'Logging config should exist');
      assert.strictEqual((loggingConfig as any).level, 'warn', 'Should use production log level');
    });
  });

  t.test("Multi-Environment Configuration", (t) => {
    t.test("should handle environment-specific overrides", async () => {
      @provider('default')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class DefaultConfig extends BaseConfigProvider {
        get config() {
          return {
            features: {
              enableFeatureA: false,
              enableFeatureB: false
            },
            api: {
              timeout: 30000,
              retries: 3
            }
          };
        }
      }

      @provider('development', 20) // Higher priority
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class DevelopmentConfig extends BaseConfigProvider {
        get config() {
          return {
            features: {
              enableFeatureA: true
            },
            api: {
              timeout: 60000
            }
          };
        }
      }

      @provider('development', 10) // Lower priority
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class DevelopmentExtraConfig extends BaseConfigProvider {
        get config() {
          return {
            features: {
              enableFeatureA: false, // Should be overridden by higher priority
              enableFeatureB: true
            }
          };
        }
      }

      // Set development environment
      BaseDi.register('development', { key: 'env' });

      // Initialize system
      await BaseInitializer.run();

      // Verify configurations
      const featuresConfig = BaseDi.resolve('Config.features') as any;
      const apiConfig = BaseDi.resolve('Config.api') as any;

      // Higher priority (20) should override lower priority (10)
      assert.strictEqual(featuresConfig.enableFeatureA, true, 'High priority config should win');
      assert.strictEqual(featuresConfig.enableFeatureB, true, 'Should merge non-conflicting properties');
      
      // Should inherit from default where not overridden
      assert.strictEqual(apiConfig.retries, 3, 'Should inherit default retries');
      assert.strictEqual(apiConfig.timeout, 60000, 'Should use development timeout');
    });
  });

  t.test("Service Injection Configuration", (t) => {
    t.test("should inject merged config objects into services", async () => {
      // Create config providers
      @provider('default')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class ServiceConfig extends BaseConfigProvider {
        get config() {
          return {
            database: {
              host: 'localhost',
              port: 5432
            },
            api: {
              baseUrl: 'http://localhost:8080',
              timeout: 5000
            }
          };
        }
      }

      // Create service that depends on configuration
      @registerDi()
      class DatabaseService {
        @di('Config.database')
        accessor dbConfig!: any;

        getConnectionString(): string {
          return `postgresql://${this.dbConfig.host}:${this.dbConfig.port}`;
        }

        isSSLEnabled(): boolean {
          return this.dbConfig.ssl ?? false;
        }
      }

      @registerDi()
      class ApiService {
        @di('Config.api')
        accessor apiConfig!: any;

        getApiUrl(endpoint: string): string {
          return `${this.apiConfig.baseUrl}${endpoint}`;
        }

        getTimeout(): number {
          return this.apiConfig.timeout ?? 30000;
        }
      }

      // Set environment and initialize
      BaseDi.register('default', { key: 'env' });
      await BaseInitializer.run();

      // Resolve services and test configuration injection
      const dbService = BaseDi.resolve(DatabaseService);
      const apiService = BaseDi.resolve(ApiService);

      // Test database service configuration
      assert.strictEqual(dbService.getConnectionString(), 'postgresql://localhost:5432');
      assert.strictEqual(dbService.isSSLEnabled(), false);

      // Test API service configuration
      assert.strictEqual(apiService.getApiUrl('/users'), 'http://localhost:8080/users');
      assert.strictEqual(apiService.getTimeout(), 5000);
    });
  });

  t.test("Error Handling and Edge Cases", (t) => {
    t.test("should handle missing environment gracefully", async () => {
      @provider('default')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class BasicConfig extends BaseConfigProvider {
        get config() {
          return {
            api: {
              baseUrl: 'http://localhost'
            }
          };
        }
      }

      // Don't register environment - should default to empty string and be converted to 'default'
      // BaseConfig should handle this gracefully
      
      await BaseInitializer.run();

      // Should still work with default configs
      const apiConfig = BaseDi.resolve('Config.api') as any;
      assert.strictEqual(apiConfig.baseUrl, 'http://localhost');
    });

    t.test("should handle empty config providers", async () => {
      @provider('default')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class EmptyConfig extends BaseConfigProvider {
        get config() {
          return {};
        }
      }

      BaseDi.register('default', { key: 'env' });
      await BaseInitializer.run();

      // Should not throw errors during setup, but config keys won't exist
      // Attempting to resolve non-existent config keys should throw
      assert.throws(() => {
        BaseDi.resolve('Config.database');
      }, /No registration found for key 'Config.database'/);
      assert.throws(() => {
        BaseDi.resolve('Config.api');
      }, /No registration found for key 'Config.api'/);
    });

    t.test("should handle config providers with undefined properties", async () => {
      @provider('default')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class UndefinedConfig extends BaseConfigProvider {
        get config() {
          return {
            database: {
              host: undefined,
              port: 5432
            }
          } as any; // Allow undefined for testing
        }
      }

      BaseDi.register('default', { key: 'env' });
      await BaseInitializer.run();

      const dbConfig = BaseDi.resolve('Config.database') as any;
      assert.strictEqual(dbConfig.host, undefined);
      assert.strictEqual(dbConfig.port, 5432);
    });
  });
});
