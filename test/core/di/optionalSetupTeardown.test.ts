import { test } from 'node:test';
import * as assert from 'node:assert';
import { registerDi } from "../../../src/core/di/decorators/registerDi";
import { BaseDi, BaseInitializer } from "../../../src/core/di/baseDi";

test("Optional Setup/Teardown Methods", (t) => {
  t.beforeEach(async () => {
    await BaseDi.teardown();
    BaseInitializer.clear();
  });

  t.test("should allow singleton with setup=true but no setup method", async () => {
    @registerDi({ singleton: true, setup: true, phase: 10 })
    class ServiceWithoutSetup {
      public initialized = false;
      
      constructor() {
        this.initialized = true;
      }
    }

    // Should work during initialization run
    await BaseInitializer.run();

    // Should have created the instance
    const instance = BaseDi.resolve<ServiceWithoutSetup>("ServiceWithoutSetup");
    assert.strictEqual(instance.initialized, true);
  });

  t.test("should allow singleton with teardown=true but no teardown method", async () => {
    @registerDi({ singleton: true, teardown: true, phase: 20 })
    class ServiceWithoutTeardown {
      public initialized = false;
      
      constructor() {
        this.initialized = true;
      }
    }

    // Create the instance
    const instance = BaseDi.resolve<ServiceWithoutTeardown>("ServiceWithoutTeardown");
    assert.strictEqual(instance.initialized, true);

    // Should not throw during teardown
    await BaseDi.teardown();
  });

  t.test("should enforce that phase requires singleton=true", () => {
    assert.throws(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      @registerDi({ singleton: false, phase: 10 })
      class NonSingletonWithPhase {
        public value = 42; // Added to avoid empty class
      }
      return NonSingletonWithPhase;
    }, {
      message: /Configuration Error.*phase.*singleton.*not set to true/
    });
  });

  t.test("should still work with setup method present", async () => {
    let setupCalled = false;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @registerDi({ singleton: true, setup: true, phase: 30 })
    class ServiceWithSetup {
      async setup(): Promise<void> {
        setupCalled = true;
      }
    }

    await BaseInitializer.run();
    assert.strictEqual(setupCalled, true);
  });

  t.test("should still work with teardown method present", async () => {
    let teardownCalled = false;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @registerDi({ singleton: true, teardown: true, phase: 40 })
    class ServiceWithTeardown {
      async teardown(): Promise<void> {
        teardownCalled = true;
      }
    }

    // Create instance and call teardown
    BaseDi.resolve("ServiceWithTeardown");
    await BaseDi.teardown();
    assert.strictEqual(teardownCalled, true);
  });

  t.test("should respect phase ordering even without setup methods", async () => {
    const order: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @registerDi({ singleton: true, setup: true, phase: 10 })
    class ServicePhase10 {
      constructor() {
        order.push("ServicePhase10");
      }
      
      public value = 10; // Added property to avoid lint error
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @registerDi({ singleton: true, setup: true, phase: 5 })
    class ServicePhase5 {
      constructor() {
        order.push("ServicePhase5");
      }
      
      public value = 5; // Added property to avoid lint error
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @registerDi({ singleton: true, setup: true, phase: 15 })
    class ServicePhase15 {
      constructor() {
        order.push("ServicePhase15");
      }
      
      public value = 15; // Added property to avoid lint error
    }

    await BaseInitializer.run();

    // Should be created in phase order (5, 10, 15)
    assert.deepStrictEqual(order, ["ServicePhase5", "ServicePhase10", "ServicePhase15"]);
  });
});
