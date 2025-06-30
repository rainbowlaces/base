/* eslint-disable @typescript-eslint/naming-convention */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { BaseDi, BaseInitializer } from "../../../src/core/di/baseDi";
import { registerDi } from "../../../src/core/di/decorators/registerDi";
import { di } from "../../../src/core/di/decorators/di";
import { diByTag } from "../../../src/core/di/decorators/diByTag";

describe("DI System Integration Tests", () => {
  beforeEach(async () => {
    await BaseDi.teardown();
    BaseInitializer.clear();
  });

  afterEach(async () => {
    await BaseDi.teardown();
    BaseInitializer.clear();
  });

  describe("Complete DI Container Lifecycle", () => {
    it("should handle complete lifecycle with decorators", async () => {
      const setupOrder: string[] = [];
      const teardownOrder: string[] = [];

      @registerDi({ singleton: true, setup: true, teardown: true, phase: 10 })
      class DatabaseService {
        isSetup = false;
        isTornDown = false;

        async setup(): Promise<void> {
          setupOrder.push("DatabaseService");
          this.isSetup = true;
        }

        async teardown(): Promise<void> {
          teardownOrder.push("DatabaseService");
          this.isTornDown = true;
        }

        query(sql: string): string {
          return `Result for: ${sql}`;
        }
      }

      @registerDi({ singleton: true, setup: true, teardown: true, phase: 20 })
      class ApiService {
        @di("DatabaseService")
        accessor db!: DatabaseService;

        isSetup = false;
        isTornDown = false;

        async setup(): Promise<void> {
          setupOrder.push("ApiService");
          this.isSetup = true;
        }

        async teardown(): Promise<void> {
          teardownOrder.push("ApiService");
          this.isTornDown = true;
        }

        getData(id: string): string {
          return this.db.query(`SELECT * FROM data WHERE id = ${id}`);
        }
      }

      @registerDi({ singleton: true, setup: true, teardown: true, phase: 30 })
      class WebService {
        @di("ApiService")
        accessor api!: ApiService;

        isSetup = false;
        isTornDown = false;

        async setup(): Promise<void> {
          setupOrder.push("WebService");
          this.isSetup = true;
        }

        async teardown(): Promise<void> {
          teardownOrder.push("WebService");
          this.isTornDown = true;
        }

        handleRequest(id: string): string {
          return `Web response: ${this.api.getData(id)}`;
        }
      }

      // Initialize all services
      await BaseInitializer.run();

      // Verify setup order (by phase)
      assert.deepStrictEqual(setupOrder, ["DatabaseService", "ApiService", "WebService"]);

      // Verify all services are properly setup
      const db = BaseDi.resolve<DatabaseService>("DatabaseService");
      const api = BaseDi.resolve<ApiService>("ApiService");
      const web = BaseDi.resolve<WebService>("WebService");

      assert.strictEqual(db.isSetup, true);
      assert.strictEqual(api.isSetup, true);
      assert.strictEqual(web.isSetup, true);

      // Verify dependency injection works
      const result = web.handleRequest("123");
      assert.strictEqual(result, "Web response: Result for: SELECT * FROM data WHERE id = 123");

      // Teardown
      await BaseDi.teardown();

      // Verify teardown order (reverse of setup)
      assert.deepStrictEqual(teardownOrder, ["WebService", "ApiService", "DatabaseService"]);

      assert.strictEqual(db.isTornDown, true);
      assert.strictEqual(api.isTornDown, true);
      assert.strictEqual(web.isTornDown, true);
    });

    it("should handle mixed singleton and non-singleton services", () => {
      @registerDi({ singleton: true })
      class ConfigService {
        config = { apiUrl: "https://api.example.com" };
      }

      @registerDi({ singleton: false })
      class RequestHandler {
        @di("ConfigService")
        accessor config!: ConfigService;

        id = Math.random();

        handle(): string {
          return `Handled with ${this.config.config.apiUrl} (${this.id})`;
        }
      }

      const config1 = BaseDi.resolve<ConfigService>("ConfigService");
      const config2 = BaseDi.resolve<ConfigService>("ConfigService");
      assert.strictEqual(config1, config2); // Same singleton instance

      const handler1 = BaseDi.resolve<RequestHandler>("RequestHandler");
      const handler2 = BaseDi.resolve<RequestHandler>("RequestHandler");
      assert.notStrictEqual(handler1, handler2); // Different instances
      assert.notStrictEqual(handler1.id, handler2.id);

      // But they should share the same config service
      assert.strictEqual(handler1.handle().includes("https://api.example.com"), true);
      assert.strictEqual(handler2.handle().includes("https://api.example.com"), true);
    });
  });

  describe("Autoload and Decorator Integration", () => {
    it("should work with autoloaded services pattern", () => {
      // Register some services with tags to simulate autoload pattern
      @registerDi({ tags: ["service"] })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class UserService {
        getUser(id: string) {
          return { id, name: "User " + id };
        }
      }

      @registerDi({ tags: ["service"] })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class AuthService {
        authenticate(token: string) {
          return token === "valid";
        }
      }

      @registerDi({ tags: ["service"] })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class ManualService {
        getValue() {
          return "manual";
        }
      }

      @registerDi({ tags: ["controller"] })
      class UserController {
        @diByTag("service")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        accessor services!: any[];

        handle() {
          return "Controller with " + this.services.length.toString() + " services";
        }
      }

      @registerDi()
      class TestController {
        @diByTag("service")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        accessor services!: any[];

        @diByTag("controller")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        accessor controllers!: any[];

        getServiceCount(): number {
          return this.services.length;
        }

        getControllerCount(): number {
          return this.controllers.length;
        }
      }

      // Test the integration
      const testController = BaseDi.resolve<TestController>("TestController");
      
      // Should have 3 services: ManualService, UserService, AuthService
      assert.strictEqual(testController.getServiceCount(), 3);
      
      // Should have 1 controller: UserController
      assert.strictEqual(testController.getControllerCount(), 1);

      const userController = BaseDi.resolve<UserController>("UserController");
      assert.strictEqual(userController.handle(), "Controller with 3 services");
    });
  });

  describe("Real-World Usage Scenarios", () => {
    it("should handle web request processing scenario", async () => {
      // Simulate a web application architecture
      let requestCount = 0;
      const logMessages: string[] = [];

      @registerDi({ singleton: true, setup: true, phase: 10 })
      class Logger {
        async setup(): Promise<void> {
          logMessages.push("Logger initialized");
        }

        log(message: string): void {
          logMessages.push(`[LOG] ${message}`);
        }
      }

      @registerDi({ singleton: true, setup: true, phase: 20 })
      class Database {
        @di("Logger")
        accessor logger!: Logger;

        isConnected = false;

        async setup(): Promise<void> {
          this.isConnected = true;
          this.logger.log("Database connected");
        }

        findUser(id: string): { id: string; name: string } | null {
          this.logger.log(`Finding user ${id}`);
          return { id, name: `User ${id}` };
        }
      }

      @registerDi({ singleton: false })
      class RequestContext {
        requestId = ++requestCount;

        getRequestId(): number {
          return this.requestId;
        }
      }

      @registerDi({ singleton: false })
      class UserController {
        @di("Database")
        accessor db!: Database;
        
        @di("Logger")
        accessor logger!: Logger;

        private _context?: RequestContext;

        get context(): RequestContext {
          this._context ??= BaseDi.resolve<RequestContext>("RequestContext");
          return this._context;
        }

        getUser(id: string): { user: { id: string; name: string } | null; requestId: number } {
          const requestId = this.context.getRequestId();
          this.logger.log(`Request ${requestId} created`);
          const user = this.db.findUser(id);
          return {
            user,
            requestId
          };
        }
      }

      // Initialize the application
      await BaseInitializer.run();

      // Verify initialization
      assert.deepStrictEqual(logMessages, [
        "Logger initialized",
        "[LOG] Database connected"
      ]);

      // Simulate multiple requests
      const controller1 = BaseDi.resolve<UserController>("UserController");
      const result1 = controller1.getUser("123");

      const controller2 = BaseDi.resolve<UserController>("UserController");
      const result2 = controller2.getUser("456");

      // Different request contexts (non-singleton)
      assert.notStrictEqual(result1.requestId, result2.requestId);
      assert.strictEqual(result1.requestId, 1);
      assert.strictEqual(result2.requestId, 2);

      // Same user data format
      assert.deepStrictEqual(result1.user, { id: "123", name: "User 123" });
      assert.deepStrictEqual(result2.user, { id: "456", name: "User 456" });

      // Check that the database singleton was shared
      const finalLogs = logMessages.slice(2); // Skip initialization logs
      assert.deepStrictEqual(finalLogs, [
        "[LOG] Request 1 created",
        "[LOG] Finding user 123",
        "[LOG] Request 2 created", 
        "[LOG] Finding user 456"
      ]);
    });

    it("should handle plugin architecture scenario", () => {
      // Define plugin interface
      interface Plugin {
        name: string;
        process(data: string): string;
      }

      @registerDi({ tags: ["plugin"] })
      class _UppercasePlugin implements Plugin {
        name = "uppercase";
        
        process(data: string): string {
          return data.toUpperCase();
        }
      }

      @registerDi({ tags: ["plugin"] })
      class _ReversePlugin implements Plugin {
        name = "reverse";
        
        process(data: string): string {
          return data.split("").reverse().join("");
        }
      }

      @registerDi({ tags: ["plugin"] })
      class _PrefixPlugin implements Plugin {
        name = "prefix";
        
        process(data: string): string {
          return `[PROCESSED] ${data}`;
        }
      }

      @registerDi({ singleton: true })
      class PluginManager {
        @diByTag("plugin")
        accessor plugins!: Plugin[];

        processData(data: string): string {
          let result = data;
          for (const plugin of this.plugins) {
            result = plugin.process(result);
          }
          return result;
        }

        getPluginNames(): string[] {
          return this.plugins.map(p => p.name).sort();
        }
      }

      const manager = BaseDi.resolve<PluginManager>("PluginManager");
      
      // Check all plugins are loaded
      assert.deepStrictEqual(manager.getPluginNames(), ["prefix", "reverse", "uppercase"]);

      // Test data processing pipeline
      const result = manager.processData("hello");
      // Processing order: uppercase -> reverse -> prefix
      // "hello" -> "HELLO" -> "OLLEH" -> "[PROCESSED] OLLEH"
      assert.strictEqual(result, "[PROCESSED] OLLEH");
    });

    it("should handle circular dependency detection in complex scenarios", () => {
      @registerDi("ServiceA")
      class _ServiceA {
        serviceB: unknown;
        
        constructor() {
          this.serviceB = BaseDi.resolve("ServiceB");
        }

        getValue(): string {
          return "A-" + (this.serviceB as { getValue(): string }).getValue();
        }
      }

      @registerDi("ServiceB")
      class _ServiceB {
        serviceC: unknown;
        
        constructor() {
          this.serviceC = BaseDi.resolve("ServiceC");
        }

        getValue(): string {
          return "B-" + (this.serviceC as { getValue(): string }).getValue();
        }
      }

      @registerDi("ServiceC")
      class _ServiceC {
        serviceA: unknown;
        
        constructor() {
          this.serviceA = BaseDi.resolve("ServiceA");
        }

        getValue(): string {
          return "C-" + (this.serviceA as { getValue(): string }).getValue();
        }
      }

      // Should detect circular dependency when trying to resolve during construction
      assert.throws(() => {
        BaseDi.resolve<_ServiceA>("ServiceA");
      }, {
        name: "Error",
        message: /Circular dependency detected/
      });
    });
  });

  describe("Performance and Stress Testing", () => {
    it("should handle many services efficiently", () => {
      const startTime = Date.now();
      
      // Register 100 services with unique names
      for (let i = 0; i < 100; i++) {
        @registerDi({ key: `PerformanceService${i}`, tags: ["performance"], singleton: i % 2 === 0 })
        class _PerformanceService {
          id = i;
          value = `service-${i}`;
          
          process(): string {
            return `processed-${this.value}`;
          }
        }
      }

      const registrationTime = Date.now() - startTime;

      // Resolve all services by tag
      const resolveStart = Date.now();
      const services = BaseDi.resolveByTag<{ process(): string }>("performance");
      const resolveTime = Date.now() - resolveStart;

      assert.strictEqual(services.length, 100);
      
      // Performance should be reasonable (less than 100ms for registration + resolution)
      assert.strictEqual(registrationTime + resolveTime < 100, true, 
        `Performance too slow: registration=${registrationTime}ms, resolve=${resolveTime}ms`);

      // Test batch processing
      const processStart = Date.now();
      const results = services.map(s => s.process());
      const processTime = Date.now() - processStart;

      assert.strictEqual(results.length, 100);
      assert.strictEqual(processTime < 50, true, `Processing too slow: ${processTime}ms`);
    });

    it("should handle concurrent resolution requests", async () => {
      @registerDi({ singleton: true })
      class ConcurrentService {
        private static instanceCount = 0;
        
        constructor() {
          ConcurrentService.instanceCount++;
        }

        static getInstanceCount(): number {
          return ConcurrentService.instanceCount;
        }

        async asyncMethod(): Promise<string> {
          await new Promise(resolve => setTimeout(resolve, 1));
          return "async-result";
        }
      }

      // Resolve the same singleton service concurrently
      const promises = Array.from({ length: 50 }, () => 
        Promise.resolve(BaseDi.resolve<ConcurrentService>("ConcurrentService"))
      );

      const instances = await Promise.all(promises);

      // All should be the same instance (singleton)
      const firstInstance = instances[0];
      for (const instance of instances) {
        assert.strictEqual(instance, firstInstance);
      }

      // Only one instance should have been created
      assert.strictEqual(ConcurrentService.getInstanceCount(), 1);

      // Test concurrent async calls
      const asyncPromises = instances.slice(0, 10).map(instance => 
        instance.asyncMethod()
      );

      const results = await Promise.all(asyncPromises);
      assert.strictEqual(results.length, 10);
      assert.strictEqual(results.every(r => r === "async-result"), true);
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle initialization failures gracefully", async () => {
      let setupCallCount = 0;

      @registerDi({ setup: true, phase: 10, singleton: true })
      class _GoodService {
        async setup(): Promise<void> {
          setupCallCount++;
        }
      }

      @registerDi({ setup: true, phase: 20, singleton: true })
      class _BadService {
        async setup(): Promise<void> {
          throw new Error("Setup failed");
        }
      }

      @registerDi({ setup: true, phase: 30, singleton: true })
      class _NeverReachedService {
        async setup(): Promise<void> {
          setupCallCount++;
        }
      }

      // Initialize should fail on BadService
      await assert.rejects(async () => {
        await BaseInitializer.run();
      }, {
        message: "Setup failed"
      });

      // GoodService should have been set up
      assert.strictEqual(setupCallCount, 1);
    });

    it("should handle missing dependencies gracefully", () => {
      @registerDi()
      class ServiceWithMissingDep {
        @di("NonExistentService")
        accessor missing!: unknown;

        useService(): string {
          return (this.missing as { doSomething(): string }).doSomething();
        }
      }

      const service = BaseDi.resolve<ServiceWithMissingDep>("ServiceWithMissingDep");
      
      // Should throw when trying to access the missing dependency
      assert.throws(() => {
        service.useService();
      }, {
        name: "Error",
        message: /No registration found for key 'NonExistentService'/
      });
    });

    it("should handle teardown failures gracefully", async () => {
      const teardownOrder: string[] = [];

      @registerDi({ singleton: true, teardown: true, key: "GoodTeardownService" })
      class _GoodTeardownService {
        async teardown(): Promise<void> {
          teardownOrder.push("good");
        }
      }

      @registerDi({ singleton: true, teardown: true, key: "BadTeardownService" })
      class _BadTeardownService {
        async teardown(): Promise<void> {
          teardownOrder.push("bad-attempted");
          throw new Error("Teardown failed");
        }
      }

      @registerDi({ singleton: true, teardown: true, key: "AnotherGoodService" })
      class _AnotherGoodService {
        async teardown(): Promise<void> {
          teardownOrder.push("another-good");
        }
      }

      // Resolve all services to create instances (required for teardown to run)
      const service1 = BaseDi.resolve<_GoodTeardownService>("GoodTeardownService");
      const service2 = BaseDi.resolve<_BadTeardownService>("BadTeardownService");
      const service3 = BaseDi.resolve<_AnotherGoodService>("AnotherGoodService");

      // Verify instances are created
      assert.ok(service1 instanceof _GoodTeardownService);
      assert.ok(service2 instanceof _BadTeardownService);
      assert.ok(service3 instanceof _AnotherGoodService);

      // Teardown should continue despite failures
      await BaseDi.teardown();

      // All teardown attempts should have been made
      assert.strictEqual(teardownOrder.length, 3);
      assert.strictEqual(teardownOrder.includes("good"), true);
      assert.strictEqual(teardownOrder.includes("bad-attempted"), true);
      assert.strictEqual(teardownOrder.includes("another-good"), true);
    });
  });
});
