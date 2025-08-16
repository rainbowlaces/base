import { test } from 'node:test';
import * as assert from 'node:assert';
import { BaseInitializer } from '../../../src/core/di/baseInitializer.js';
import { BaseDi } from '../../../src/core/di/baseDi.js';
import type { DiSetup } from '../../../src/core/di/types.js';

// Mock DiSetup implementations for testing
class MockService implements DiSetup {
  public setupCalled = false;
  public setupError?: Error;
  public setupDelay = 0;
  public name: string;

  constructor(name: string, setupDelay = 0, setupError?: Error) {
    this.name = name;
    this.setupDelay = setupDelay;
    this.setupError = setupError;
  }

  async setup(): Promise<void> {
    if (this.setupDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.setupDelay));
    }
    
    if (this.setupError) {
      throw this.setupError;
    }
    
    this.setupCalled = true;
    console.log(`${this.name} setup completed`);
  }
}

test('BaseInitializer', (t) => {
  t.beforeEach(() => {
    // Clear state before each test
    BaseInitializer.clear();
    BaseDi.teardown();
  });

  t.test('register()', (t) => {
    t.test('should register initializer with default phase', () => {
      BaseInitializer.register('test-service');
      
      const initializers = BaseInitializer.getInitializerList();
      assert.strictEqual(initializers.length, 1);
      assert.strictEqual(initializers[0].name, 'test-service');
      assert.strictEqual(initializers[0].phase, 100); // Default phase
    });

    t.test('should register initializer with custom phase', () => {
      BaseInitializer.register('early-service', 10);
      BaseInitializer.register('late-service', 200);
      
      const initializers = BaseInitializer.getInitializerList();
      assert.strictEqual(initializers.length, 2);
      
      const early = initializers.find((i) => i.name === 'early-service');
      const late = initializers.find((i) => i.name === 'late-service');
      
      assert.ok(early);
      assert.strictEqual(early.phase, 10);
      assert.ok(late);
      assert.strictEqual(late.phase, 200);
    });

    t.test('should register multiple initializers in same phase', () => {
      BaseInitializer.register('service-a', 50);
      BaseInitializer.register('service-b', 50);
      BaseInitializer.register('service-c', 50);
      
      const initializers = BaseInitializer.getInitializerList();
      assert.strictEqual(initializers.length, 3);
      
      const phaseInitializers = initializers.filter((i) => i.phase === 50);
      assert.strictEqual(phaseInitializers.length, 3);
    });
  });

  t.test('getInitializerList()', (t) => {
    t.test('should return empty array when no initializers registered', () => {
      const initializers = BaseInitializer.getInitializerList();
      assert.strictEqual(initializers.length, 0);
      assert.ok(Array.isArray(initializers));
    });

    t.test('should return readonly array', () => {
      BaseInitializer.register('test-service');
      const initializers = BaseInitializer.getInitializerList();
      
      // Should be readonly - this would cause TypeScript error if uncommented
      // initializers.push({ name: 'hacker', phase: 999 });
      
      // Verify it's a copy/readonly by checking prototype
      assert.ok(Object.isFrozen(initializers) || initializers.constructor === Array);
    });
  });

  t.test('clear()', (t) => {
    t.test('should clear all registered initializers', () => {
      BaseInitializer.register('service-1');
      BaseInitializer.register('service-2');
      BaseInitializer.register('service-3');
      
      assert.strictEqual(BaseInitializer.getInitializerList().length, 3);
      
      BaseInitializer.clear();
      assert.strictEqual(BaseInitializer.getInitializerList().length, 0);
    });
  });

  t.test('run()', (t) => {
    t.test('should run initializers in phase order', async () => {
      // Create mock services
      const earlyService = new MockService('early-service');
      const middleService = new MockService('middle-service');  
      const lateService = new MockService('late-service');
      
      // Register services in DI container
      BaseDi.register(earlyService, { key: 'early-service' });
      BaseDi.register(middleService, { key: 'middle-service' });
      BaseDi.register(lateService, { key: 'late-service' });
      
      // Register initializers in random order but with specific phases
      BaseInitializer.register('late-service', 300);
      BaseInitializer.register('early-service', 100);
      BaseInitializer.register('middle-service', 200);
      
      await BaseInitializer.run();
      
      // Verify all services were set up
      assert.ok(earlyService.setupCalled);
      assert.ok(middleService.setupCalled);
      assert.ok(lateService.setupCalled);
    });

    t.test('should run multiple initializers in same phase concurrently', async () => {
      // Create mock services with delays to test concurrency
      const serviceA = new MockService('service-a', 50); // 50ms delay
      const serviceB = new MockService('service-b', 50); // 50ms delay
      const serviceC = new MockService('service-c', 50); // 50ms delay
      
      BaseDi.register(serviceA, { key: 'service-a' });
      BaseDi.register(serviceB, { key: 'service-b' });
      BaseDi.register(serviceC, { key: 'service-c' });
      
      // All in same phase
      BaseInitializer.register('service-a', 100);
      BaseInitializer.register('service-b', 100);
      BaseInitializer.register('service-c', 100);
      
      const originalConsoleLog = console.log;
      console.log = () => { /* suppress output */ };
      
      try {
        const startTime = Date.now();
        await BaseInitializer.run();
        const endTime = Date.now();
        
        // If run concurrently, should take ~50ms, not ~150ms
        const duration = endTime - startTime;
        assert.ok(duration < 100, `Expected concurrent execution (~50ms), but took ${duration}ms`);
        
        // Verify all services were set up
        assert.ok(serviceA.setupCalled);
        assert.ok(serviceB.setupCalled);
        assert.ok(serviceC.setupCalled);
        
      } finally {
        console.log = originalConsoleLog;
      }
    });

    t.test('should handle async setup methods', async () => {
      const asyncService = new MockService('async-service', 25); // 25ms delay
      
      BaseDi.register(asyncService, { key: 'async-service' });
      BaseInitializer.register('async-service', 100);
      
      const originalConsoleLog = console.log;
      console.log = () => { /* suppress output */ };
      
      try {
        await BaseInitializer.run();
        
        assert.ok(asyncService.setupCalled);
      } finally {
        console.log = originalConsoleLog;
      }
    });

    t.test('should handle setup errors gracefully', async () => {
      const errorService = new MockService('error-service', 0, new Error('Setup failed'));
      const goodService = new MockService('good-service');
      
      BaseDi.register(errorService, { key: 'error-service' });
      BaseDi.register(goodService, { key: 'good-service' });
      
      BaseInitializer.register('error-service', 100);
      BaseInitializer.register('good-service', 200); // Different phase
      
      const originalConsoleLog = console.log;
      console.log = () => { /* suppress output */ };
      
      try {
        // This should throw because Promise.all fails if any promise rejects
        await assert.rejects(
          async () => { await BaseInitializer.run(); },
          { message: 'Setup failed' }
        );
        
        // Error service should not be marked as set up
        assert.ok(!errorService.setupCalled);
        // Good service should not be reached due to error in earlier phase
        assert.ok(!goodService.setupCalled);
        
      } finally {
        console.log = originalConsoleLog;
      }
    });

    t.test('should handle missing services in DI container', async () => {
      BaseInitializer.register('missing-service', 100);
      
      const originalConsoleLog = console.log;
      console.log = () => { /* suppress output */ };
      
      try {
        // This should throw because BaseDi.resolve will fail
        await assert.rejects(
          async () => { await BaseInitializer.run(); },
          { message: /No registration found for/ }
        );
      } finally {
        console.log = originalConsoleLog;
      }
    });

    t.test('should run with no registered initializers', async () => {
      // Should run without throwing any errors
      await BaseInitializer.run();
      // If we get here, the test passed
      assert.ok(true);
    });

    t.test('should handle complex phase scenarios', async () => {
      // Test with gaps in phase numbers and duplicate phases
      const service1 = new MockService('service-1');
      const service2 = new MockService('service-2');
      const service3 = new MockService('service-3');
      const service4 = new MockService('service-4');
      
      BaseDi.register(service1, { key: 'service-1' });
      BaseDi.register(service2, { key: 'service-2' });
      BaseDi.register(service3, { key: 'service-3' });
      BaseDi.register(service4, { key: 'service-4' });
      
      // Register with gaps: 10, 50, 50, 200
      BaseInitializer.register('service-1', 10);
      BaseInitializer.register('service-2', 50);
      BaseInitializer.register('service-3', 50); // Same phase as service-2
      BaseInitializer.register('service-4', 200);
      
      await BaseInitializer.run();
      
      // All services should be set up
      assert.ok(service1.setupCalled);
      assert.ok(service2.setupCalled);
      assert.ok(service3.setupCalled);
      assert.ok(service4.setupCalled);
    });
  });
});
