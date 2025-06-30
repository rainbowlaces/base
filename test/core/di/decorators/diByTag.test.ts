import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { diByTag } from "../../../../src/core/di/decorators/diByTag";
import { BaseDi } from "../../../../src/core/di/baseDi";

describe("@diByTag decorator", () => {
  beforeEach(async () => {
    await BaseDi.teardown();
  });

  afterEach(async () => {
    await BaseDi.teardown();
  });

  describe("Basic Tag Resolution", () => {
    it("should inject array of services by tag", () => {
      class ServiceA {
        name = "A";
      }
      
      class ServiceB {
        name = "B";
      }

      // Register services with the same tag
      BaseDi.register(ServiceA, { 
        key: "serviceA", 
        tags: new Set(["handler"]) 
      });
      BaseDi.register(ServiceB, { 
        key: "serviceB", 
        tags: new Set(["handler"]) 
      });

      class TestClass {
        @diByTag("handler")
        accessor handlers!: (ServiceA | ServiceB)[];
      }

      const instance = new TestClass();
      assert.strictEqual(instance.handlers.length, 2);
      
      const names = instance.handlers.map(h => h.name).sort();
      assert.deepStrictEqual(names, ["A", "B"]);
    });

    it("should return empty array when no services match tag", () => {
      class TestClass {
        @diByTag("nonExistentTag")
        accessor handlers!: unknown[];
      }

      const instance = new TestClass();
      assert.strictEqual(instance.handlers.length, 0);
      assert.ok(Array.isArray(instance.handlers));
    });

    it("should work with single service having the tag", () => {
      class SingleService {
        value = "single";
      }

      BaseDi.register(SingleService, { 
        key: "single", 
        tags: new Set(["special"]) 
      });

      class TestClass {
        @diByTag("special")
        accessor services!: SingleService[];
      }

      const instance = new TestClass();
      assert.strictEqual(instance.services.length, 1);
      assert.strictEqual(instance.services[0].value, "single");
    });
  });

  describe("Multiple Tags per Service", () => {
    it("should find services with multiple tags", () => {
      class ServiceA {
        type = "A";
      }
      
      class ServiceB {
        type = "B";
      }

      // Register services with multiple tags
      BaseDi.register(ServiceA, { 
        key: "serviceA", 
        tags: new Set(["handler", "processor", "async"]) 
      });
      BaseDi.register(ServiceB, { 
        key: "serviceB", 
        tags: new Set(["handler", "sync"]) 
      });

      class TestClass {
        @diByTag("handler")
        accessor handlers!: (ServiceA | ServiceB)[];

        @diByTag("processor")
        accessor processors!: ServiceA[];

        @diByTag("async")
        accessor asyncServices!: ServiceA[];

        @diByTag("sync")
        accessor syncServices!: ServiceB[];
      }

      const instance = new TestClass();
      
      // Both services have "handler" tag
      assert.strictEqual(instance.handlers.length, 2);
      
      // Only ServiceA has "processor" tag
      assert.strictEqual(instance.processors.length, 1);
      assert.strictEqual(instance.processors[0].type, "A");
      
      // Only ServiceA has "async" tag
      assert.strictEqual(instance.asyncServices.length, 1);
      assert.strictEqual(instance.asyncServices[0].type, "A");
      
      // Only ServiceB has "sync" tag
      assert.strictEqual(instance.syncServices.length, 1);
      assert.strictEqual(instance.syncServices[0].type, "B");
    });
  });

  describe("Property Mutability", () => {
    it("should throw error when trying to set injected property", () => {
      class ServiceA {
        value = "test";
      }
      BaseDi.register(ServiceA, { 
        key: "serviceA", 
        tags: new Set(["test"]) 
      });

      class TestClass {
        @diByTag("test")
        accessor services!: ServiceA[];
      }

      const instance = new TestClass();
      
      // Should throw when trying to assign
      assert.throws(() => {
        instance.services = [];
      }, {
        name: "Error",
        message: /Cannot assign to dependency-injected property/
      });
    });

    it("should include property name in error message", () => {
      class ServiceA {
        value = "test";
      }
      BaseDi.register(ServiceA, { 
        key: "serviceA", 
        tags: new Set(["test"]) 
      });

      class TestClass {
        @diByTag("test")
        accessor myTaggedServices!: ServiceA[];
      }

      const instance = new TestClass();
      
      assert.throws(() => {
        instance.myTaggedServices = [];
      }, {
        name: "Error",
        message: /Cannot assign to dependency-injected property 'myTaggedServices'/
      });
    });
  });

  describe("Fresh Resolution", () => {
    it("should resolve services fresh on each access", () => {
      let resolutionCount = 0;
      
      class ServiceA {
        constructor() {
          resolutionCount++;
        }
        name = "A";
      }

      BaseDi.register(ServiceA, { 
        key: "serviceA", 
        tags: new Set(["test"]),
        singleton: false // Ensure new instances on each resolve
      });

      class TestClass {
        @diByTag("test")
        accessor services!: ServiceA[];
      }

      const instance = new TestClass();
      
      // Services should not be resolved yet
      assert.strictEqual(resolutionCount, 0);
      
      // First access should trigger resolution
      const services1 = instance.services;
      assert.strictEqual(resolutionCount, 1);
      assert.strictEqual(services1.length, 1);
      
      // Second access should resolve fresh instances
      const services2 = instance.services;
      assert.strictEqual(resolutionCount, 2); // Fresh resolution each time
      assert.notStrictEqual(services1, services2); // Different array references
      assert.notStrictEqual(services1[0], services2[0]); // Different service instances
    });

    it("should handle empty results properly", () => {
      class TestClass {
        @diByTag("nonExistent")
        accessor services!: unknown[];
      }

      const instance = new TestClass();
      
      const services1 = instance.services;
      const services2 = instance.services;
      
      // Should return different empty array references each time
      assert.notStrictEqual(services1, services2);
      assert.strictEqual(services1.length, 0);
      assert.strictEqual(services2.length, 0);
    });
  });

  describe("Integration with Different Service Types", () => {
    it("should work with constructor-registered services", () => {
      class ConstructorService {
        constructor(private value: string = "constructor") {}
        getValue() { return this.value; }
      }

      BaseDi.register(ConstructorService, { 
        key: "constructor", 
        tags: new Set(["constructorType"]) 
      });

      class TestClass {
        @diByTag("constructorType")
        accessor services!: ConstructorService[];
      }

      const instance = new TestClass();
      assert.strictEqual(instance.services.length, 1);
      assert.strictEqual(instance.services[0].getValue(), "constructor");
    });

    it("should work with instance-registered services", () => {
      class InstanceService {
        value = "instance";
      }

      const serviceInstance = new InstanceService();
      BaseDi.register(serviceInstance, { 
        key: "instance", 
        tags: new Set(["instanceType"]) 
      });

      class TestClass {
        @diByTag("instanceType")
        accessor services!: InstanceService[];
      }

      const instance = new TestClass();
      assert.strictEqual(instance.services.length, 1);
      assert.strictEqual(instance.services[0], serviceInstance);
      assert.strictEqual(instance.services[0].value, "instance");
    });

    it("should work with scalar-registered services", () => {
      const config = { apiUrl: "https://api.example.com" };
      BaseDi.register(config, { 
        key: "config", 
        tags: new Set(["configuration"]) 
      });

      class TestClass {
        @diByTag("configuration")
        accessor configs!: typeof config[];
      }

      const instance = new TestClass();
      assert.strictEqual(instance.configs.length, 1);
      assert.strictEqual(instance.configs[0].apiUrl, "https://api.example.com");
    });
  });

  describe("Mixed Service Types", () => {
    it("should handle mixed constructor and instance services", () => {
      class ServiceA {
        type = "constructor";
      }

      class ServiceB {
        type = "instance";
      }

      // Register one as constructor, one as instance
      BaseDi.register(ServiceA, { 
        key: "serviceA", 
        tags: new Set(["mixed"]) 
      });
      
      const serviceBInstance = new ServiceB();
      BaseDi.register(serviceBInstance, { 
        key: "serviceB", 
        tags: new Set(["mixed"]) 
      });

      class TestClass {
        @diByTag("mixed")
        accessor services!: (ServiceA | ServiceB)[];
      }

      const instance = new TestClass();
      assert.strictEqual(instance.services.length, 2);
      
      const types = instance.services.map(s => s.type).sort();
      assert.deepStrictEqual(types, ["constructor", "instance"]);
    });
  });

  describe("Type Safety and Generics", () => {
    it("should work with typed interfaces", () => {
      interface IHandler {
        handle(): string;
      }

      class HandlerA implements IHandler {
        handle(): string { return "A"; }
      }

      class HandlerB implements IHandler {
        handle(): string { return "B"; }
      }

      BaseDi.register(HandlerA, { 
        key: "handlerA", 
        tags: new Set(["handler"]) 
      });
      BaseDi.register(HandlerB, { 
        key: "handlerB", 
        tags: new Set(["handler"]) 
      });

      class TestClass {
        @diByTag("handler")
        accessor handlers!: IHandler[];
      }

      const instance = new TestClass();
      assert.strictEqual(instance.handlers.length, 2);
      
      const results = instance.handlers.map(h => h.handle()).sort();
      assert.deepStrictEqual(results, ["A", "B"]);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle services that throw during construction", () => {
      class ProblematicService {
        constructor() {
          throw new Error("Construction failed");
        }
        
        // Add a method to avoid "only constructor" warning
        doSomething() {
          return "never called";
        }
      }

      BaseDi.register(ProblematicService, { 
        key: "problematic", 
        tags: new Set(["problematic"]) 
      });

      class TestClass {
        @diByTag("problematic")
        accessor services!: ProblematicService[];
      }

      const instance = new TestClass();
      
      // Should propagate the construction error
      assert.throws(() => {
        const _services = instance.services;
      }, {
        name: "Error",
        message: /Construction failed/
      });
    });

    it("should handle null/undefined tags gracefully", () => {
      class TestClass {
        @diByTag("")
        accessor services!: unknown[];
      }

      const instance = new TestClass();
      assert.strictEqual(instance.services.length, 0);
    });
  });
});
