import { test } from 'node:test';
import * as assert from 'node:assert';
import type { ConfigData } from '../../../src/core/config/types.js';
import { BaseClassConfig } from '../../../src/core/config/types.js';

// Test class for ConfigData utility type
class TestModuleConfig extends BaseClassConfig {
  message: string = 'default message';
  enabled: boolean = true;
  timeout: number = 5000;
  nested: {
    value: string;
    count: number;
  } = {
    value: 'nested default',
    count: 42
  };
}

test('ConfigData<T> utility type', (t) => {
  t.test('should extract correct type structure from class', () => {
    // This test verifies that ConfigData<T> correctly extracts the type structure
    // from a class, making it suitable for use in provider configurations
    
    // Create a ConfigData type instance
    const configData: ConfigData<TestModuleConfig> = {
      message: 'test message',
      enabled: false,
      timeout: 3000,
      nested: {
        value: 'test nested',
        count: 100
      }
    };
    
    // Verify the type structure matches what we expect
    assert.strictEqual(typeof configData.message, 'string');
    assert.strictEqual(typeof configData.enabled, 'boolean');
    assert.strictEqual(typeof configData.timeout, 'number');
    assert.strictEqual(typeof configData.nested, 'object');
    assert.strictEqual(typeof configData.nested?.value, 'string');
    assert.strictEqual(typeof configData.nested?.count, 'number');
    
    // Verify values
    assert.strictEqual(configData.message, 'test message');
    assert.strictEqual(configData.enabled, false);
    assert.strictEqual(configData.timeout, 3000);
    assert.strictEqual(configData.nested!.value, 'test nested');
    assert.strictEqual(configData.nested!.count, 100);
  });

  t.test('should allow partial configuration', () => {
    // ConfigData<T> should allow partial objects (common in providers)
    const partialConfig: Partial<ConfigData<TestModuleConfig>> = {
      message: 'only message',
      nested: {
        value: 'only nested value',
        count: 42  // count is required in nested object
      }
    };
    
    assert.strictEqual(partialConfig.message, 'only message');
    assert.ok(partialConfig.nested, 'nested object should exist');
    assert.strictEqual(partialConfig.nested.value, 'only nested value');
    assert.strictEqual(partialConfig.nested.count, 42);
  });

  t.test('should work with deeply nested objects', () => {
    // Test with more complex nested structure
    class ComplexConfig extends BaseClassConfig {
      api: {
        endpoints: {
          users: string;
          posts: string;
        };
        auth: {
          token: string;
          refresh: boolean;
        };
      } = {
        endpoints: {
          users: '/api/users',
          posts: '/api/posts'
        },
        auth: {
          token: 'default-token',
          refresh: true
        }
      };
    }
    
    const complexConfigData: ConfigData<ComplexConfig> = {
      api: {
        endpoints: {
          users: '/v2/users',
          posts: '/v2/posts'
        },
        auth: {
          token: 'auth-token',
          refresh: false
        }
      }
    };
    
    assert.strictEqual(complexConfigData.api!.endpoints.users, '/v2/users');
    assert.strictEqual(complexConfigData.api!.endpoints.posts, '/v2/posts');
    assert.strictEqual(complexConfigData.api!.auth.token, 'auth-token');
    assert.strictEqual(complexConfigData.api!.auth.refresh, false);
  });
});
