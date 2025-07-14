import { test } from 'node:test';
import * as assert from 'node:assert';
import { BaseClassConfig } from '../../../src/core/config/types.js';

test('BaseClassConfig', (t) => {
  
  t.test('constructor behavior', (t) => {
    
    t.test('should create instance with default values when no data provided', () => {
      class TestConfig extends BaseClassConfig {
        message: string = "default message";
        timeout: number = 5000;
        enabled: boolean = true;
      }
      
      const config = new TestConfig();
      
      assert.strictEqual(config.message, "default message");
      assert.strictEqual(config.timeout, 5000);
      assert.strictEqual(config.enabled, true);
    });
    
    t.test('should hydrate existing properties with provided data', () => {
      class TestConfig extends BaseClassConfig {
        message: string = "default message";
        timeout: number = 5000;
        enabled: boolean = true;
      }
      
      const config = new TestConfig();
      config.hydrate({
        message: "custom message",
        timeout: 10000
      });
      
      assert.strictEqual(config.message, "custom message");
      assert.strictEqual(config.timeout, 10000);
      assert.strictEqual(config.enabled, true); // Should keep default
    });
    
    t.test('should ignore unknown properties in data', () => {
      class TestConfig extends BaseClassConfig {
        message: string = "default message";
        timeout: number = 5000;
      }
      
      const config = new TestConfig();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      config.hydrate({
        message: "custom message",
        unknownProperty: "should be ignored",
        anotherUnknown: 999
      } as any);
      
      assert.strictEqual(config.message, "custom message");
      assert.strictEqual(config.timeout, 5000);
      assert.strictEqual((config as any).unknownProperty, undefined);
      assert.strictEqual((config as any).anotherUnknown, undefined);
    });
    
    t.test('should preserve class methods and getters', () => {
      class TestConfig extends BaseClassConfig {
        message: string = "default message";
        timeout: number = 5000;
        
        getMessage(): string {
          return `Message: ${this.message}`;
        }
        
        get timeoutInMs(): number {
          return this.timeout * 1000;
        }
      }
      
      const config = new TestConfig();
      config.hydrate({
        message: "custom message",
        timeout: 3
      });
      
      // Properties should be hydrated
      assert.strictEqual(config.message, "custom message");
      assert.strictEqual(config.timeout, 3);
      
      // Methods should work
      assert.strictEqual(config.getMessage(), "Message: custom message");
      assert.strictEqual(config.timeoutInMs, 3000);
    });
    
    t.test('should work with nested objects', () => {
      class TestConfig extends BaseClassConfig {
        database: { host: string; port: number } = { host: "localhost", port: 5432 };
        api: { baseUrl: string; timeout: number } = { baseUrl: "http://localhost", timeout: 5000 };
      }
      
      const config = new TestConfig();
      config.hydrate({
        database: { host: "prod-db", port: 3306 },
        api: { baseUrl: "https://api.example.com", timeout: 10000 }
      });
      
      assert.strictEqual(config.database.host, "prod-db");
      assert.strictEqual(config.database.port, 3306);
      assert.strictEqual(config.api.baseUrl, "https://api.example.com");
      assert.strictEqual(config.api.timeout, 10000);
    });
    
    t.test('should handle undefined data gracefully', () => {
      class TestConfig extends BaseClassConfig {
        message: string = "default message";
        timeout: number = 5000;
      }
      
      const config = new TestConfig();
      config.hydrate(undefined);
      
      assert.strictEqual(config.message, "default message");
      assert.strictEqual(config.timeout, 5000);
    });
    
    t.test('should handle null data gracefully', () => {
      class TestConfig extends BaseClassConfig {
        message: string = "default message";
        timeout: number = 5000;
      }
      
      const config = new TestConfig();
      config.hydrate(null);
      
      assert.strictEqual(config.message, "default message");
      assert.strictEqual(config.timeout, 5000);
    });
    
    t.test('should handle empty object data', () => {
      class TestConfig extends BaseClassConfig {
        message: string = "default message";
        timeout: number = 5000;
      }
      
      const config = new TestConfig();
      config.hydrate({});
      
      assert.strictEqual(config.message, "default message");
      assert.strictEqual(config.timeout, 5000);
    });
    
  });
  
  t.test('inheritance', (t) => {
    
    t.test('should work with class inheritance', () => {
      class BaseConfig extends BaseClassConfig {
        baseProperty: string = "base value";
      }
      
      class ExtendedConfig extends BaseConfig {
        extendedProperty: number = 42;
      }
      
      const config = new ExtendedConfig();
      config.hydrate({
        baseProperty: "custom base",
        extendedProperty: 100
      });
      
      assert.strictEqual(config.baseProperty, "custom base");
      assert.strictEqual(config.extendedProperty, 100);
    });
    
  });
  
});
