import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { BaseContext } from "../../../src/core/module/baseContext.js";
import { BaseDi } from "../../../src/core/di/baseDi.js";
import { BasePubSub } from "../../../src/core/pubsub/basePubSub.js";
import { type BaseLogger } from "../../../src/core/logger/baseLogger.js";
import { BaseModule } from "../../../src/core/module/baseModule.js";
import { request } from "../../../src/core/requestHandler/decorators/request.js";
import { registerDi } from "../../../src/core/di/decorators/registerDi.js";
import { type BaseActionArgs } from "../../../src/core/module/types.js";

// Extend BaseContextData for test purposes using declaration merging
declare module "../../../src/core/module/baseContext.js" {
  interface BaseContextData {
    dependent?: string;
    regular?: string;
    requestAction?: string;
    coordinatedAction?: string;
    testValue?: string;
  }
}

// Test module with request actions for integration testing
@registerDi()
class TestModule extends BaseModule {
  actionOrder: string[] = [];

  // Action that throws an error for testing error handling
  @request({ topic: '/test', phase: 0 })
  async errorAction(_args: BaseActionArgs): Promise<void> {
    this.actionOrder.push('error');
    throw new Error('Test error');
  }

  // Action with dependencies for testing dependency resolution  
  @request({ topic: '/test', phase: 1 })
  async dependentAction(args: BaseActionArgs): Promise<void> {
    this.actionOrder.push('dependent');
    args.context.data.dependent = 'completed';
  }

  // Regular action for testing basic execution
  @request({ topic: '/test', phase: 2 })
  async regularAction(args: BaseActionArgs): Promise<void> {
    this.actionOrder.push('regular');
    args.context.data.regular = 'completed';
  }

  // Non-action method (should not be discoverable as action)
  regularMethod(): string {
    return 'not an action';
  }
}

// Concrete implementation for testing abstract BaseContext
class TestContext extends BaseContext<Record<string, any>> {
  constructor() {
    super(
      (id: string, module: string, action: string, status: string) =>
        `/test/${id}/${module}/${action}/${status}`
    );
  }

  protected getContextType(): string {
    return "test";
  }

  // Expose coordinateAndRun for testing
  async testCoordination(topic: string): Promise<void> {
    await this.coordinateAndRun(topic);
  }
}

describe("BaseContext Unit Tests", () => {
  let realPubSub: BasePubSub;
  let mockLogger: BaseLogger;

  beforeEach(() => {
    // Only reset DI for unit tests, not integration tests
    // Integration tests need decorator subscriptions to remain intact
  });

  afterEach(async () => {
    // Clean up DI state and static registry
    await BaseDi.teardown();
    // Clear static action registry
    (BaseContext as any).actionRegistry.clear();
  });

  describe("Constructor and Basic Properties", () => {
    beforeEach(() => {
      // Reset DI state for unit tests only
      BaseDi.reset();
      
      // Use real BasePubSub for integration
      realPubSub = new BasePubSub();

      // Simple noop logger mock
      mockLogger = {
        debug: () => { /* noop */ },
        info: () => { /* noop */ },
        warn: () => { /* noop */ },
        error: () => { /* noop */ },
        trace: () => { /* noop */ },
        fatal: () => { /* noop */ }
      } as unknown as BaseLogger;

      // Register in DI
      BaseDi.register(realPubSub, { key: "BasePubSub" });
      BaseDi.register(mockLogger, { key: "BaseLogger" });
    });

    it("should create context with unique ID", () => {
      const context1 = new TestContext();
      const context2 = new TestContext();

      assert.ok(context1.id, "Context should have an ID");
      assert.ok(context2.id, "Context should have an ID");
      assert.notStrictEqual(context1.id, context2.id, "IDs should be unique");
      assert.strictEqual(typeof context1.id, "string", "ID should be a string");
    });

    it("should initialize with pending state", () => {
      const context = new TestContext();
      assert.strictEqual(context.state, "pending", "Initial state should be pending");
    });

    it("should initialize with empty data object", () => {
      const context = new TestContext();
      assert.deepStrictEqual(context.data, {}, "Data should be empty object initially");
    });

    it("should have creation timestamp", () => {
      const before = Date.now();
      const context = new TestContext();
      const after = Date.now();

      assert.ok(context.created >= before, "Creation time should be after test start");
      assert.ok(context.created <= after, "Creation time should be before test end");
      assert.strictEqual(typeof context.created, "number", "Creation time should be a number");
    });

    it("should calculate age correctly", (_, done) => {
      const context = new TestContext();
      const initialAge = context.age;
      
      // Wait a bit and check age increased
      setTimeout(() => {
        assert.ok(context.age > initialAge, "Age should increase over time");
        done();
      }, 10); // Increased to 10ms for more reliable timing
    });

    it("should extend EventEmitter", () => {
      const context = new TestContext();
      
      // Test event emitter functionality
      let eventFired = false;
      context.on("test", () => { eventFired = true; });
      context.emit("test");
      
      assert.ok(eventFired, "Should be able to emit and listen to events");
    });
  });

  describe("State Management", () => {
    beforeEach(() => {
      // Reset DI state for unit tests only
      BaseDi.reset();
      
      // Use real BasePubSub for integration
      realPubSub = new BasePubSub();

      // Simple noop logger mock
      mockLogger = {
        debug: () => { /* noop */ },
        info: () => { /* noop */ },
        warn: () => { /* noop */ },
        error: () => { /* noop */ },
        trace: () => { /* noop */ },
        fatal: () => { /* noop */ }
      } as unknown as BaseLogger;

      // Register in DI
      BaseDi.register(realPubSub, { key: "BasePubSub" });
      BaseDi.register(mockLogger, { key: "BaseLogger" });
    });
    it("should transition to done state", () => {
      const context = new TestContext();
      context.done();
      assert.strictEqual(context.state, "done", "State should be done");
    });

    it("should transition to error state", () => {
      const context = new TestContext();
      context.error();
      assert.strictEqual(context.state, "error", "State should be error");
    });

    it("should transition to running state", () => {
      const context = new TestContext();
      context.start();
      assert.strictEqual(context.state, "running", "State should be running");
    });

    it("should not transition from error to done", () => {
      const context = new TestContext();
      context.error();
      context.done();
      assert.strictEqual(context.state, "error", "Should remain in error state");
    });

    it("should not transition from done to error", () => {
      const context = new TestContext();
      context.done();
      context.error();
      assert.strictEqual(context.state, "done", "Should remain in done state");
    });

    it("should not start from done state", () => {
      const context = new TestContext();
      context.done();
      context.start();
      assert.strictEqual(context.state, "done", "Should remain in done state");
    });

    it("should not start from error state", () => {
      const context = new TestContext();
      context.error();
      context.start();
      assert.strictEqual(context.state, "error", "Should remain in error state");
    });
  });

  describe("Module Testing", () => {
    beforeEach(() => {
      // Reset DI and inject real dependencies for module testing that needs coordination
      BaseDi.reset();
      
      // Use real PubSub for dependency coordination to work
      const realPubSub = new BasePubSub();
      BaseDi.register(realPubSub, { key: "BasePubSub" });
      
        function debugLog(...args: unknown[]) {
          if (process.env.DEBUG_LOG) {
            console.debug(`[DEBUG]`, ...args);
          }
        }

      // Mock Logger
    mockLogger = {
      debug: (...args: unknown[]) => { debugLog(...args); },
      info:  (...args: unknown[]) => { debugLog(...args); },
      warn:  (...args: unknown[]) => { debugLog(...args); },
      error: (...args: unknown[]) => { debugLog(...args); },
      trace: (...args: unknown[]) => { debugLog(...args); },
      fatal: (...args: unknown[]) => { debugLog(...args); }
    } as unknown as BaseLogger;
      BaseDi.register(mockLogger, { key: "BaseLogger" });
    });

    it("should execute request actions directly", async () => {
      const testModule = new TestModule();
      const context = new TestContext();

      // Call the module actions directly
      await testModule.dependentAction({ 
        context, 
        module: "TestModule", 
        action: "dependentAction",
        topic: "/test"
      });
      await testModule.regularAction({ 
        context, 
        module: "TestModule", 
        action: "regularAction",
        topic: "/test"
      });

      // Verify actions executed and data was set
      assert.strictEqual(context.data.dependent, 'completed', "Dependent action should complete");
      assert.strictEqual(context.data.regular, 'completed', "Regular action should complete");
      // Verify execution order
      const dependentIndex = testModule.actionOrder.indexOf('dependent');
      const regularIndex = testModule.actionOrder.indexOf('regular');
      assert.ok(dependentIndex < regularIndex, "Dependent action should execute before regular action");
    });

    describe("BaseModule Core Functionality", () => {
      it("should have correct namespace", () => {
        const testModule = new TestModule();
        assert.strictEqual(testModule.namespace, "TestModule", "Namespace should match constructor name");
      });

      it("should discover actions correctly", async () => {
        const testModule = new TestModule();

        // Should find action methods
        const dependentAction = testModule.getAction('dependentAction');
        const regularAction = testModule.getAction('regularAction');
        
        assert.ok(dependentAction, "Should find dependentAction");
        assert.ok(regularAction, "Should find regularAction");
        assert.strictEqual(typeof dependentAction, 'function', "Action should be a function");

        // Should not find non-action methods
        const regularMethod = testModule.getAction('regularMethod');
        assert.strictEqual(regularMethod, undefined, "Should not find regular methods as actions");

        // Should not find non-existent methods
        const nonExistent = testModule.getAction('nonExistentAction');
        assert.strictEqual(nonExistent, undefined, "Should return undefined for non-existent actions");
      });

      it("should handle action execution errors", async () => {
        const testModule = new TestModule();
        const context = new TestContext();

        // Execute action that throws error
        await testModule.executeAction('errorAction', {
          context,
          module: "TestModule", 
          action: "errorAction",
          topic: "/test"
        });

        // Action should have been attempted
        assert.ok(testModule.actionOrder.includes('error'), "Error action should have been called");
        
        // Context should remain in pending state (not done) since action errored
        assert.strictEqual(context.state, 'pending', "Context should remain pending after action error");
      });

      it("should skip actions when context is done", async () => {
        const testModule = new TestModule();
        const context = new TestContext();
        
        // Mark context as done
        context.done();

        // Try to execute action
        await testModule.executeAction('regularAction', {
          context,
          module: "TestModule", 
          action: "regularAction",
          topic: "/test"
        });

        // Action should not have executed
        assert.ok(!testModule.actionOrder.includes('regular'), "Regular action should not execute when context is done");
        assert.strictEqual(context.data.regular, undefined, "Action should not set data when context is done");
      });

      it("should skip actions when context is in error state", async () => {
        const testModule = new TestModule();
        const context = new TestContext();
        
        // Mark context as error
        context.error();

        // Try to execute action
        await testModule.executeAction('regularAction', {
          context,
          module: "TestModule", 
          action: "regularAction",
          topic: "/test"
        });

        // Action should not have executed
        assert.ok(!testModule.actionOrder.includes('regular'), "Regular action should not execute when context is in error");
        assert.strictEqual(context.data.regular, undefined, "Action should not set data when context is error");
      });

      it("should handle non-existent actions gracefully", async () => {
        const testModule = new TestModule();
        const context = new TestContext();

        // Try to execute non-existent action - should not throw
        await testModule.executeAction('nonExistentAction', {
          context,
          module: "TestModule", 
          action: "nonExistentAction",
          topic: "/test"
        });

        // Should complete without error
        assert.strictEqual(context.state, 'pending', "Context should remain pending");
      });

      it("should call setup and teardown methods", async () => {
        const testModule = new TestModule();

        // Setup should complete without error
        await testModule.setup();
        
        // Teardown should complete without error  
        await testModule.teardown();

        // Test passes if no exceptions thrown
        assert.ok(true, "Setup and teardown should complete successfully");
      });
    });

    it("should handle coordination errors gracefully", async () => {
      const context = new TestContext();
      
      // Try to coordinate a topic with no handlers
      try {
        await context.testCoordination('/nonexistent/topic');
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.ok(error instanceof Error, "Should throw an Error");
        assert.ok(error.message.includes('No handlers'), "Error should mention no handlers");
        assert.strictEqual(context.state, 'error', "Context should be in error state");
      }
    });
  });

  describe("Dependency Management", () => {
    beforeEach(() => {
      // Reset DI and setup real dependencies for TestContext
      BaseDi.reset();
      
      // Use REAL PubSub for dependency management - TestContext needs this to work
      const realPubSub = new BasePubSub();
      BaseDi.register(realPubSub, { key: "BasePubSub" });
      
      const mockLogger = {
        debug: () => { /* noop */ },
        info: () => { /* noop */ },
        warn: () => { /* noop */ },
        error: () => { /* noop */ },
        trace: () => { /* noop */ },
        fatal: () => { /* noop */ }
      } as unknown as BaseLogger;
      BaseDi.register(mockLogger, { key: "BaseLogger" });
    });

    it("should resolve waitFor when dependencies are met", async () => {
      const context = new TestContext();
      
      // Start waiting for dependencies first
      const waitPromise = context.waitFor(['module1/action1', 'module2/action2']);
      
      // Then mark dependencies as completed after a brief delay
      setTimeout(() => {
        context.actionDone('module1', 'action1');
        context.actionDone('module2', 'action2');
      }, 10);

      await waitPromise;
      // If we get here, waitFor resolved successfully
      assert.ok(true, "waitFor should resolve when dependencies are met");
    });

    it("should reject waitFor on dependency error", async () => {
      const context = new TestContext();
      
      // Start waiting for dependency first
      const waitPromise = context.waitFor(['module1/action1']);
      
      // Then mark dependency as errored after a brief delay
      setTimeout(() => {
        context.actionError('module1', 'action1');
      }, 10);

      try {
        await waitPromise;
        assert.fail("waitFor should have rejected");
      } catch (error) {
        assert.ok(error instanceof Error, "Should reject with Error");
        assert.ok(error.message.includes('Dependencies not met'), "Error should mention dependencies");
      }
    });
  });
});
