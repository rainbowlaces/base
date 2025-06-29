import { test } from 'node:test';
import * as assert from 'node:assert';
import { BaseDi } from '../../../src';
import { type DiTeardown } from '../../../src/core/di/types';

test('BaseDi', (t) => {
  t.beforeEach(async () => {
    // Clean up before each test
    await BaseDi.teardown();
  });

  t.test('register()', (t) => {
    t.test('should register a constructor with default options', () => {
      class TestService {
        // Add a method to avoid empty class warning
        getValue(): string { return 'test'; }
      }
      
      BaseDi.register(TestService);
      
      const instance = BaseDi.resolve(TestService);
      assert.ok(instance instanceof TestService);
    });

    t.test('should register a constructor with custom key', () => {
      class TestService {
        getValue(): string { return 'test'; }
      }
      
      BaseDi.register(TestService, 'customKey');
      
      const instance = BaseDi.resolve<TestService>('customKey');
      assert.ok(instance instanceof TestService);
    });

    t.test('should register a constructor with wrapper options', () => {
      class TestService {
        getValue(): string { return 'test'; }
      }
      
      BaseDi.register(TestService, { 
        key: 'test', 
        singleton: true,
        tags: new Set(['service', 'test'])
      });
      
      const instance1 = BaseDi.resolve<TestService>('test');
      const instance2 = BaseDi.resolve<TestService>('test');
      assert.strictEqual(instance1, instance2); // Should be same instance (singleton)
    });

    t.test('should register an instance', () => {
      class TestService {
        value = 'test';
      }
      const testInstance = new TestService();
      
      BaseDi.register(testInstance);
      
      const resolved = BaseDi.resolve<TestService>('TestService');
      assert.strictEqual(resolved, testInstance);
      assert.strictEqual(resolved.value, 'test');
    });

    t.test('should register a scalar value', () => {
      BaseDi.register('hello world', { key: 'greeting' });
      
      const greeting = BaseDi.resolve<string>('greeting');
      assert.strictEqual(greeting, 'hello world');
    });

    t.test('should register different scalar types', () => {
      BaseDi.register(42, { key: 'number' });
      BaseDi.register(true, { key: 'boolean' });
      BaseDi.register(null, { key: 'null' });
      BaseDi.register(undefined, { key: 'undefined' });
      
      assert.strictEqual(BaseDi.resolve<number>('number'), 42);
      assert.strictEqual(BaseDi.resolve<boolean>('boolean'), true);
      assert.strictEqual(BaseDi.resolve<null>('null'), null);
      
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      const undefinedValue = BaseDi.resolve<undefined>('undefined');
      assert.strictEqual(undefinedValue, undefined);
    });

    t.test('should throw error when registering scalar without key', () => {
      assert.throws(() => {
        BaseDi.register('value', {});
      }, /Key is required for scalar values/);
    });

    t.test('should throw error for invalid value type', () => {
      assert.throws(() => {
        // Arrow functions don't have prototype, so they're not constructors
        // but they're also not objects, instances, or scalars
        const arrowFunc = () => { return 'test'; };
        BaseDi.register(arrowFunc as never);
      }, /Invalid value type for DI registration/);
    });
  });

  t.test('resolve()', (t) => {
    t.test('should resolve by constructor reference', () => {
      class TestService {
        getValue(): string { return 'test'; }
      }
      BaseDi.register(TestService);
      
      const instance = BaseDi.resolve(TestService);
      assert.ok(instance instanceof TestService);
    });

    t.test('should resolve by string key', () => {
      class TestService {
        getValue(): string { return 'test'; }
      }
      BaseDi.register(TestService, 'test');
      
      const instance = BaseDi.resolve<TestService>('test');
      assert.ok(instance instanceof TestService);
    });

    t.test('should pass constructor arguments', () => {
      class TestService {
        constructor(public value: string, public count: number) {}
      }
      BaseDi.register(TestService);
      
      const instance = BaseDi.resolve(TestService, 'hello', 42);
      assert.strictEqual(instance.value, 'hello');
      assert.strictEqual(instance.count, 42);
    });

    t.test('should throw error for unregistered key', () => {
      assert.throws(() => {
        BaseDi.resolve('nonexistent');
      }, /Dependency Injection Error: No registration found for key 'nonexistent'/);
    });
  });

  t.test('singleton behavior', (t) => {
    t.test('should create new instances for non-singleton constructors', () => {
      class TestService {
        getValue(): string { return 'test'; }
      }
      BaseDi.register(TestService, { singleton: false });
      
      const instance1 = BaseDi.resolve(TestService);
      const instance2 = BaseDi.resolve(TestService);
      assert.notStrictEqual(instance1, instance2);
    });

    t.test('should return same instance for singleton constructors', () => {
      class TestService {
        getValue(): string { return 'test'; }
      }
      BaseDi.register(TestService, { singleton: true });
      
      const instance1 = BaseDi.resolve(TestService);
      const instance2 = BaseDi.resolve(TestService);
      assert.strictEqual(instance1, instance2);
    });

    t.test('should always return same instance for registered instances', () => {
      class TestService {
        getValue(): string { return 'test'; }
      }
      const instance = new TestService();
      BaseDi.register(instance);
      
      const resolved1 = BaseDi.resolve('TestService');
      const resolved2 = BaseDi.resolve('TestService');
      assert.strictEqual(resolved1, instance);
      assert.strictEqual(resolved2, instance);
    });

    t.test('should always return same value for scalars', () => {
      BaseDi.register('test', { key: 'value' });
      
      const value1 = BaseDi.resolve('value');
      const value2 = BaseDi.resolve('value');
      assert.strictEqual(value1, 'test');
      assert.strictEqual(value2, 'test');
    });
  });

  t.test('circular dependency detection', (t) => {
    t.test('should detect and throw error for circular dependencies', () => {
      class ServiceA {
        name = 'A';
        constructor() {
          BaseDi.resolve('ServiceB');
        }
      }
      
      class ServiceB {
        name = 'B';
        constructor() {
          BaseDi.resolve('ServiceA');
        }
      }
      
      BaseDi.register(ServiceA, 'ServiceA');
      BaseDi.register(ServiceB, 'ServiceB');
      
      assert.throws(() => {
        BaseDi.resolve('ServiceA');
      }, /Circular dependency detected/);
    });

    t.test('should detect complex circular dependencies', () => {
      class ServiceA {
        name = 'A';
        constructor() {
          BaseDi.resolve('ServiceB');
        }
      }
      
      class ServiceB {
        name = 'B';
        constructor() {
          BaseDi.resolve('ServiceC');
        }
      }
      
      class ServiceC {
        name = 'C';
        constructor() {
          BaseDi.resolve('ServiceA');
        }
      }
      
      BaseDi.register(ServiceA, 'ServiceA');
      BaseDi.register(ServiceB, 'ServiceB');
      BaseDi.register(ServiceC, 'ServiceC');
      
      assert.throws(() => {
        BaseDi.resolve('ServiceA');
      }, /Circular dependency detected/);
    });
  });

  t.test('resolveByTag()', (t) => {
    t.test('should resolve all services with a specific tag', () => {
      class ServiceA {
        name = 'A';
      }
      class ServiceB {
        name = 'B';
      }
      class ServiceC {
        name = 'C';
      }
      
      BaseDi.register(ServiceA, { tags: new Set(['api', 'service']) });
      BaseDi.register(ServiceB, { tags: new Set(['api', 'helper']) });
      BaseDi.register(ServiceC, { tags: new Set(['database']) });
      
      const apiServices = BaseDi.resolveByTag('api');
      assert.strictEqual(apiServices.length, 2);
      assert.ok(apiServices.some(s => s instanceof ServiceA));
      assert.ok(apiServices.some(s => s instanceof ServiceB));
      assert.ok(!apiServices.some(s => s instanceof ServiceC));
    });

    t.test('should return empty array for unknown tag', () => {
      class ServiceA {
        name = 'A';
      }
      BaseDi.register(ServiceA, { tags: new Set(['known']) });
      
      const services = BaseDi.resolveByTag('unknown');
      assert.deepStrictEqual(services, []);
    });

    t.test('should return empty array when no services have tags', () => {
      class ServiceA {
        name = 'A';
      }
      BaseDi.register(ServiceA);
      
      const services = BaseDi.resolveByTag('any');
      assert.deepStrictEqual(services, []);
    });
  });

  t.test('teardown()', (t) => {
    t.test('should call teardown on services that implement DiTeardown', async () => {
      let teardownCalled = false;
      
      class TestService implements DiTeardown {
        async teardown(): Promise<void> {
          teardownCalled = true;
        }
      }
      
      const instance = new TestService();
      BaseDi.register(instance);
      
      await BaseDi.teardown();
      assert.strictEqual(teardownCalled, true);
    });

    t.test('should teardown services in reverse phase order', async () => {
      const teardownOrder: string[] = [];
      
      class ServiceA implements DiTeardown {
        async teardown(): Promise<void> {
          teardownOrder.push('A');
        }
      }
      
      class ServiceB implements DiTeardown {
        async teardown(): Promise<void> {
          teardownOrder.push('B');
        }
      }
      
      const serviceA = new ServiceA();
      const serviceB = new ServiceB();
      
      BaseDi.register(serviceA, { phase: 10 });
      BaseDi.register(serviceB, { phase: 20 });
      
      await BaseDi.teardown();
      assert.deepStrictEqual(teardownOrder, ['B', 'A']); // Higher phase first
    });

    t.test('should clear all registrations and instances after teardown', async () => {
      class TestService {
        getValue(): string { return 'test'; }
      }
      BaseDi.register(TestService);
      const instance = BaseDi.resolve(TestService);
      
      assert.ok(instance instanceof TestService);
      
      await BaseDi.teardown();
      
      assert.throws(() => {
        BaseDi.resolve(TestService);
      }, /Dependency Injection Error: No registration found/);
    });

    t.test('should handle services without teardown method gracefully', async () => {
      class TestService {
        getValue(): string { return 'test'; }
      }
      const instance = new TestService();
      BaseDi.register(instance);
      
      // Should not throw
      await BaseDi.teardown();
      assert.ok(true); // Test passes if no exception
    });
  });

  t.test('error cases and edge conditions', (t) => {
    t.test('should handle empty string key', () => {
      assert.throws(() => {
        BaseDi.register('value', { key: '' });
      }, /Key is required for scalar values/);
    });

    t.test('should overwrite existing registrations', () => {
      class ServiceA {
        type = 'A';
      }
      class ServiceB {
        type = 'B';
      }
      
      BaseDi.register(ServiceA, 'test');
      BaseDi.register(ServiceB, 'test'); // Overwrite
      
      const instance = BaseDi.resolve('test');
      assert.ok(instance instanceof ServiceB);
    });

    t.test('should handle null and undefined as valid instances', () => {
      BaseDi.register(null, { key: 'null' });
      BaseDi.register(undefined, { key: 'undefined' });
      
      assert.strictEqual(BaseDi.resolve('null'), null);
      
      const undefinedValue = BaseDi.resolve('undefined');
      assert.strictEqual(undefinedValue, undefined);
    });
  });
});
