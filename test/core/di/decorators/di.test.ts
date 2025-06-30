import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { di } from "../../../../src/core/di/decorators/di";
import { BaseDi } from "../../../../src/core/di/baseDi";

describe("@di decorator", () => {
  beforeEach(async () => {
    await BaseDi.teardown();
  });

  afterEach(async () => {
    await BaseDi.teardown();
  });

  describe("Property Injection by Key", () => {
    it("should inject dependency by string key", () => {
      // Register a service
      class ServiceA {
        getValue() { return "serviceA"; }
      }
      BaseDi.register(ServiceA, "serviceA");

      class TestClass {
        @di("serviceA")
        accessor service!: ServiceA;
      }

      const instance = new TestClass();
      assert.ok(instance.service instanceof ServiceA);
      assert.strictEqual(instance.service.getValue(), "serviceA");
    });

    it("should inject dependency with constructor arguments", () => {
      // Register a service that needs constructor arguments
      class ServiceWithArgs {
        private value: string;
        
        constructor(value: string) {
          this.value = value;
        }
        
        getValue() { 
          return this.value; 
        }
      }
      BaseDi.register(ServiceWithArgs, "serviceWithArgs");

      class TestClass {
        @di("serviceWithArgs", "test-arg")
        accessor service!: ServiceWithArgs;
      }

      const instance = new TestClass();
      assert.ok(instance.service instanceof ServiceWithArgs);
      assert.strictEqual(instance.service.getValue(), "test-arg");
    });

    it("should work with multiple injected properties", () => {
      class ServiceA {
        name = "A";
      }
      class ServiceB {
        name = "B";
      }
      
      BaseDi.register(ServiceA, "serviceA");
      BaseDi.register(ServiceB, "serviceB");

      class TestClass {
        @di("serviceA")
        accessor serviceA!: ServiceA;

        @di("serviceB")
        accessor serviceB!: ServiceB;
      }

      const instance = new TestClass();
      assert.strictEqual(instance.serviceA.name, "A");
      assert.strictEqual(instance.serviceB.name, "B");
    });
  });

  describe("Property Injection by Constructor", () => {
    it("should inject dependency by constructor reference", () => {
      class ServiceA {
        getValue() { return "serviceA"; }
      }
      BaseDi.register(ServiceA);

      class TestClass {
        @di(ServiceA)
        accessor service!: ServiceA;
      }

      const instance = new TestClass();
      assert.ok(instance.service instanceof ServiceA);
      assert.strictEqual(instance.service.getValue(), "serviceA");
    });

    it("should inject dependency by constructor with args", () => {
      class ServiceWithArgs {
        private value: string;
        private count: number;
        
        constructor(value: string, count: number) {
          this.value = value;
          this.count = count;
        }
        
        getValue() { 
          return `${this.value}-${this.count}`; 
        }
      }
      BaseDi.register(ServiceWithArgs);

      class TestClass {
        @di(ServiceWithArgs, "test", 42)
        accessor service!: ServiceWithArgs;
      }

      const instance = new TestClass();
      assert.ok(instance.service instanceof ServiceWithArgs);
      assert.strictEqual(instance.service.getValue(), "test-42");
    });
  });

  describe("Property Mutability", () => {
    it("should throw error when trying to set injected property", () => {
      class ServiceA {
        value = "immutable";
      }
      BaseDi.register(ServiceA, "serviceA");

      class TestClass {
        @di("serviceA")
        accessor service!: ServiceA;
      }

      const instance = new TestClass();
      
      // Should throw when trying to assign
      assert.throws(() => {
        instance.service = new ServiceA();
      }, {
        name: "Error",
        message: /Cannot assign to dependency-injected property/
      });
    });

    it("should include property name in error message", () => {
      class ServiceA {
        value = "test";
      }
      BaseDi.register(ServiceA, "serviceA");

      class TestClass {
        @di("serviceA")
        accessor mySpecialService!: ServiceA;
      }

      const instance = new TestClass();
      
      assert.throws(() => {
        instance.mySpecialService = new ServiceA();
      }, {
        name: "Error",
        message: /Cannot assign to dependency-injected property 'mySpecialService'/
      });
    });
  });

  describe("Fresh Resolution", () => {
    it("should resolve dependencies fresh on each access", () => {
      let resolutionCount = 0;
      
      class ServiceA {
        constructor() {
          resolutionCount++;
        }
        getValue() { return "fresh"; }
      }
      BaseDi.register(ServiceA, "freshService");

      class TestClass {
        @di("freshService")
        accessor service!: ServiceA;
      }

      const instance = new TestClass();
      
      // Service should not be resolved yet
      assert.strictEqual(resolutionCount, 0);
      
      // Access the property to trigger resolution
      const service = instance.service;
      assert.strictEqual(resolutionCount, 1);
      assert.ok(service instanceof ServiceA);
      
      // Subsequent accesses should resolve fresh instances
      const service2 = instance.service;
      assert.strictEqual(resolutionCount, 2); // New resolution each time
      assert.notStrictEqual(service, service2); // Different instances
    });

    it("should handle resolution errors gracefully", () => {
      class TestClass {
        @di("nonExistentService")
        accessor service!: unknown;
      }

      const instance = new TestClass();
      
      // Should throw when trying to access non-existent service
      assert.throws(() => {
        const _service = instance.service;
      }, {
        name: "Error",
        message: /No registration found for key 'nonExistentService'/
      });
    });
  });

  describe("Type Safety", () => {
    it("should work with generic types", () => {
      interface IRepository<T> {
        getItem(): T;
      }

      class UserRepository implements IRepository<string> {
        getItem(): string {
          return "user";
        }
      }

      BaseDi.register(UserRepository, "userRepo");

      class TestClass {
        @di("userRepo")
        accessor repo!: IRepository<string>;
      }

      const instance = new TestClass();
      assert.strictEqual(instance.repo.getItem(), "user");
    });

    it("should work with complex object types", () => {
      interface Config {
        apiUrl: string;
        timeout: number;
      }

      const config: Config = {
        apiUrl: "https://api.example.com",
        timeout: 5000
      };

      BaseDi.register(config, "config");

      class TestClass {
        @di("config")
        accessor config!: Config;
      }

      const instance = new TestClass();
      assert.strictEqual(instance.config.apiUrl, "https://api.example.com");
      assert.strictEqual(instance.config.timeout, 5000);
    });
  });

  describe("Integration with DI Container", () => {
    it("should work with singleton services", () => {
      class SingletonService {
        id = Math.random();
      }
      BaseDi.register(SingletonService, { key: "singleton", singleton: true });

      class TestClass1 {
        @di("singleton")
        accessor service!: SingletonService;
      }

      class TestClass2 {
        @di("singleton")
        accessor service!: SingletonService;
      }

      const instance1 = new TestClass1();
      const instance2 = new TestClass2();
      
      // Both should get the same singleton instance
      assert.strictEqual(instance1.service.id, instance2.service.id);
    });

    it("should work with non-singleton services", () => {
      class NonSingletonService {
        id = Math.random();
      }
      BaseDi.register(NonSingletonService, { key: "nonSingleton", singleton: false });

      class TestClass1 {
        @di("nonSingleton")
        accessor service!: NonSingletonService;
      }

      class TestClass2 {
        @di("nonSingleton")
        accessor service!: NonSingletonService;
      }

      const instance1 = new TestClass1();
      const instance2 = new TestClass2();
      
      // Each should get a different instance
      assert.notStrictEqual(instance1.service.id, instance2.service.id);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle circular dependencies gracefully", () => {
      // Create a scenario that might cause circular dependencies
      class ServiceA {
        getValue() { return "A"; }
      }
      
      class ServiceB {
        getValue() { return "B"; }
      }

      BaseDi.register(ServiceA, "serviceA");
      BaseDi.register(ServiceB, "serviceB");

      class TestClass {
        @di("serviceA")
        accessor serviceA!: ServiceA;

        @di("serviceB")
        accessor serviceB!: ServiceB;
      }

      const instance = new TestClass();
      assert.strictEqual(instance.serviceA.getValue(), "A");
      assert.strictEqual(instance.serviceB.getValue(), "B");
    });

    it("should handle undefined/null constructor gracefully", () => {
      class TestService {
        value = "test";
      }
      BaseDi.register(TestService, "testService");

      class TestClass {
        @di("testService")
        accessor service!: TestService;
      }

      const instance = new TestClass();
      assert.ok(instance.service instanceof TestService);
      assert.strictEqual(instance.service.value, "test");
    });
  });
});
