/* eslint-disable @typescript-eslint/naming-convention */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { registerDi } from "../../../../src/core/di/decorators/registerDi";
import { BaseDi, BaseInitializer } from "../../../../src/core/di/baseDi";

describe("@registerDi decorator", () => {
  beforeEach(async () => {
    await BaseDi.teardown();
    BaseInitializer.clear();
  });

  afterEach(async () => {
    await BaseDi.teardown();
    BaseInitializer.clear();
  });

  describe("Basic Registration", () => {
    it("should register class with default options", () => {
      @registerDi()
      class TestService {
        getValue() {
          return "test";
        }
      }

      const instance = BaseDi.resolve<TestService>("TestService");
      assert.ok(instance instanceof TestService);
      assert.strictEqual(instance.getValue(), "test");
    });

    it("should register class with custom key as string", () => {
      @registerDi("customKey")
      class TestService {
        getValue() {
          return "custom";
        }
      }

      const instance = BaseDi.resolve<TestService>("customKey");
      assert.ok(instance instanceof TestService);
      assert.strictEqual(instance.getValue(), "custom");
    });

    it("should register class with custom key in options", () => {
      @registerDi({ key: "optionsKey" })
      class TestService {
        getValue() {
          return "options";
        }
      }

      const instance = BaseDi.resolve<TestService>("optionsKey");
      assert.ok(instance instanceof TestService);
      assert.strictEqual(instance.getValue(), "options");
    });
  });

  describe("Singleton Behavior", () => {
    it("should create new instances when singleton is false (default)", () => {
      @registerDi({ singleton: false })
      class TestService {
        id = Math.random();
      }

      const instance1 = BaseDi.resolve<TestService>("TestService");
      const instance2 = BaseDi.resolve<TestService>("TestService");
      
      assert.notStrictEqual(instance1.id, instance2.id);
    });

    it("should return same instance when singleton is true", () => {
      @registerDi({ singleton: true })
      class TestService {
        id = Math.random();
      }

      const instance1 = BaseDi.resolve<TestService>("TestService");
      const instance2 = BaseDi.resolve<TestService>("TestService");
      
      assert.strictEqual(instance1.id, instance2.id);
    });
  });

  describe("Tags", () => {
    it("should register class with tags", () => {
      @registerDi({ tags: ["service", "test"] })
      class TestService {
        name = "tagged";
      }

      const servicesByTag = BaseDi.resolveByTag<TestService>("service");
      assert.strictEqual(servicesByTag.length, 1);
      assert.strictEqual(servicesByTag[0].name, "tagged");

      const testsByTag = BaseDi.resolveByTag<TestService>("test");
      assert.strictEqual(testsByTag.length, 1);
      assert.strictEqual(testsByTag[0].name, "tagged");
    });

    it("should work with empty tags array", () => {
      @registerDi({ tags: [] })
      class TestService {
        name = "no-tags";
      }

      const instance = BaseDi.resolve<TestService>("TestService");
      assert.strictEqual(instance.name, "no-tags");
    });
  });

  describe("Phase Configuration", () => {
    it("should use default phase 100", () => {
      @registerDi()
      class TestService {
        value = "test";
      }

      // Can't access internal registrations directly, but we can verify
      // that the registration worked by resolving the service
      const instance = BaseDi.resolve<TestService>("TestService");
      assert.ok(instance instanceof TestService);
      assert.strictEqual(instance.value, "test");
    });

    it("should use custom phase", () => {
      @registerDi({ singleton: true, phase: 50 })
      class TestService {
        value = "custom-phase";
      }

      // Can't access internal registrations directly, but we can verify
      // that the registration worked by resolving the service
      const instance = BaseDi.resolve<TestService>("TestService");
      assert.ok(instance instanceof TestService);
      assert.strictEqual(instance.value, "custom-phase");
    });
  });

  describe("Setup Integration", () => {
    it("should register with BaseInitializer when setup is true", () => {
      @registerDi({ setup: true, singleton: true })
      class _TestSetupService {
        async setup(): Promise<void> {
          // Setup logic
        }
      }

      const initializers = BaseInitializer.getInitializerList();
      assert.strictEqual(initializers.length, 1);
      assert.strictEqual(initializers[0].name, "_TestSetupService");
    });

    it("should use custom phase for initialization", () => {
      @registerDi({ setup: true, phase: 25, singleton: true })
      class _TestPhaseService {
        async setup(): Promise<void> {
          // Setup logic
        }
      }

      const initializers = BaseInitializer.getInitializerList();
      assert.strictEqual(initializers.length, 1);
      assert.strictEqual(initializers[0].phase, 25);
    });

    it("should throw error when setup is true but singleton is not true", () => {
      assert.throws(() => {
        @registerDi({ setup: true })
        class _TestBadService {
          async setup(): Promise<void> {
            // Has setup method but singleton is not true
          }
        }
      }, {
        name: "Error",
        message: /Configuration Error.*singleton.*not set to true/
      });
    });

    it("should not require setup method when setup is true", () => {
      // This should NOT throw anymore - setup methods are optional
      @registerDi({ setup: true, singleton: true })
      class TestServiceWithoutSetup {
        value = "test";
      }
      
      // Verify the registration worked
      const instance = BaseDi.resolve<TestServiceWithoutSetup>("TestServiceWithoutSetup");
      assert.strictEqual(instance.value, "test");
    });

    it("should not register with BaseInitializer when setup is false", () => {
      @registerDi({ setup: false })
      class _TestNoSetupService {
        async setup(): Promise<void> {
          // Setup method exists but setup: false
        }
      }

      const initializers = BaseInitializer.getInitializerList();
      assert.strictEqual(initializers.length, 0);
    });

    it("should not register with BaseInitializer when setup is undefined", () => {
      @registerDi()
      class _TestDefaultService {
        async setup(): Promise<void> {
          // Setup method exists but setup not specified
        }
      }

      const initializers = BaseInitializer.getInitializerList();
      assert.strictEqual(initializers.length, 0);
    });
  });

  describe("Teardown Validation", () => {
    it("should validate teardown method exists when teardown is true", () => {
      @registerDi({ teardown: true, singleton: true })
      class TestService {
        async teardown(): Promise<void> {
          // Teardown logic
        }
      }

      // Should not throw - class has teardown method
      const instance = BaseDi.resolve<TestService>("TestService");
      assert.ok(instance instanceof TestService);
    });

    it("should throw error when teardown is true but singleton is not true", () => {
      assert.throws(() => {
        @registerDi({ teardown: true })
        class _TestService {
          async teardown(): Promise<void> {
            // Has teardown method but singleton is not true
          }
        }
      }, {
        name: "Error",
        message: /Configuration Error.*singleton.*not set to true/
      });
    });

    it("should not require teardown method when teardown is true", () => {
      // This should NOT throw anymore - teardown methods are optional
      @registerDi({ teardown: true, singleton: true })
      class TestServiceWithoutTeardown {
        value = "test";
      }
      
      // Verify the registration worked
      const instance = BaseDi.resolve<TestServiceWithoutTeardown>("TestServiceWithoutTeardown");
      assert.strictEqual(instance.value, "test");
    });

    it("should not validate teardown method when teardown is false", () => {
      @registerDi({ teardown: false })
      class TestService {
        // No teardown method, but teardown: false so should be fine
        value = "test";
      }

      const instance = BaseDi.resolve<TestService>("TestService");
      assert.ok(instance instanceof TestService);
    });
  });

  describe("Complex Configurations", () => {
    it("should handle all options together", () => {
      @registerDi({
        key: "complexService",
        singleton: true,
        phase: 75,
        setup: true,
        teardown: true,
        tags: ["complex", "service"]
      })
      class ComplexService {
        value = "complex";

        async setup(): Promise<void> {
          // Setup logic
        }

        async teardown(): Promise<void> {
          // Teardown logic
        }
      }

      // Check DI registration
      const instance = BaseDi.resolve<ComplexService>("complexService");
      assert.ok(instance instanceof ComplexService);
      assert.strictEqual(instance.value, "complex");

      // Check singleton behavior
      const instance2 = BaseDi.resolve<ComplexService>("complexService");
      assert.strictEqual(instance, instance2);

      // Check tags
      const byTag = BaseDi.resolveByTag<ComplexService>("complex");
      assert.strictEqual(byTag.length, 1);
      assert.strictEqual(byTag[0], instance);

      // Check initializer registration
      const initializers = BaseInitializer.getInitializerList();
      assert.strictEqual(initializers.length, 1);
      assert.strictEqual(initializers[0].phase, 75);
    });
  });

  describe("Error Cases", () => {
    it("should handle classes with constructor parameters", () => {
      @registerDi()
      class ServiceWithParams {
        private param: string;
        
        constructor(param: string) {
          this.param = param;
        }

        getParam() {
          return this.param;
        }
      }

      // Should be able to resolve with parameters
      const instance = BaseDi.resolve<ServiceWithParams>("ServiceWithParams", "test-param");
      assert.strictEqual(instance.getParam(), "test-param");
    });

    it("should work with inheritance", () => {
      class BaseService {
        base = "base";
      }

      @registerDi()
      class ExtendedService extends BaseService {
        extended = "extended";
      }

      const instance = BaseDi.resolve<ExtendedService>("ExtendedService");
      assert.strictEqual(instance.base, "base");
      assert.strictEqual(instance.extended, "extended");
    });
  });
});
