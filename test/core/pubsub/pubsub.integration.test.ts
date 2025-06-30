import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { BasePubSub } from "../../../src/core/pubsub/basePubSub";
import { sub } from "../../../src/core/pubsub/decorators/sub";
import { type BasePubSubArgs } from "../../../src/core/pubsub/types";
import { BaseDi, BaseInitializer } from "../../../src/core/di/baseDi";
import { type BaseLogger } from "../../../src/core/logger/baseLogger";

describe("PubSub Integration Tests", () => {
  beforeEach(async () => {
    // Clean slate for each test
    await BaseDi.teardown();
    BaseInitializer.clear();
    
    // Set up mock logger for BasePubSub
    const mockLogger = {
      error: () => { /* Mock logger method */ },
      info: () => { /* Mock logger method */ },
      warn: () => { /* Mock logger method */ },
      debug: () => { /* Mock logger method */ },
      trace: () => { /* Mock logger method */ },
      fatal: () => { /* Mock logger method */ }
    } as unknown as BaseLogger;
    
    BaseDi.register(mockLogger, { key: "BaseLogger" });
    
    // Register BasePubSub as singleton
    BaseDi.register(BasePubSub, { singleton: true });
  });

  afterEach(async () => {
    // Clean up DI state
    await BaseDi.teardown();
    BaseInitializer.clear();
  });

  describe("@sub Decorator Integration", () => {
    it("should subscribe a class method to a topic via DI", async () => {
      let methodCalled = false;
      let receivedArgs: BasePubSubArgs | null = null;

      class TestSubscriber {
        @sub("integration/test")
        async onEvent(args: BasePubSubArgs): Promise<void> {
          methodCalled = true;
          receivedArgs = args;
        }
      }

      // Instantiate the class - this triggers the decorator's initializer
      const subscriber = new TestSubscriber();
      assert.ok(subscriber, "Subscriber should be created");

      // Get the BasePubSub instance from DI and publish
      const pubsub = BaseDi.resolve<BasePubSub>(BasePubSub);
      await pubsub.pub("integration/test", { data: "test-data" });

      assert.ok(methodCalled, "Decorated method should have been called");
      assert.ok(receivedArgs, "Method should have received arguments");
      
      const args = receivedArgs as BasePubSubArgs & { data: string };
      assert.strictEqual(args.topic, "integration/test", "Topic should match");
      assert.strictEqual(args.data, "test-data", "Data should be passed through");
    });

    it("should support multiple decorated methods in the same class", async () => {
      let method1Called = false;
      let method2Called = false;

      class MultiSubscriber {
        @sub("event/type1")
        async handleType1(_args: BasePubSubArgs): Promise<void> {
          method1Called = true;
        }

        @sub("event/type2")
        async handleType2(_args: BasePubSubArgs): Promise<void> {
          method2Called = true;
        }
      }

      // Instantiate to trigger decorators
      new MultiSubscriber();

      const pubsub = BaseDi.resolve<BasePubSub>(BasePubSub);
      
      // Test that each method responds to its own topic
      await pubsub.pub("event/type1");
      assert.ok(method1Called, "First method should be called");
      assert.ok(!method2Called, "Second method should not be called yet");

      await pubsub.pub("event/type2");
      assert.ok(method2Called, "Second method should be called");
    });

    it("should work with pattern-based subscriptions", async () => {
      let methodCalled = false;
      let receivedArgs: BasePubSubArgs | null = null;

      class PatternSubscriber {
        @sub("user/:id/updated")
        async onUserUpdate(args: BasePubSubArgs): Promise<void> {
          methodCalled = true;
          receivedArgs = args;
        }
      }

      new PatternSubscriber();

      const pubsub = BaseDi.resolve<BasePubSub>(BasePubSub);
      await pubsub.pub("user/123/updated", { name: "John" });

      assert.ok(methodCalled, "Pattern-based method should be called");
      assert.ok(receivedArgs, "Method should receive arguments");
      
      const args = receivedArgs as BasePubSubArgs & { name: string };
      assert.strictEqual(args.topic, "user/123/updated", "Topic should match");
      assert.strictEqual(args.name, "John", "Data should be passed through");
    });
  });

  describe("PubSub with DI Logger Integration", () => {
    it("should handle subscriber errors gracefully without breaking the system", async () => {
      let goodHandlerCalled = false;
      let errorThrown = false;

      class MixedSubscribers {
        @sub("error/test")
        async failingHandler(_args: BasePubSubArgs): Promise<void> {
          errorThrown = true;
          throw new Error("Intentional test error");
        }

        @sub("error/test")
        async goodHandler(_args: BasePubSubArgs): Promise<void> {
          goodHandlerCalled = true;
        }
      }

      new MixedSubscribers();

      const pubsub = BaseDi.resolve<BasePubSub>(BasePubSub);
      
      // This should complete without throwing, even though one handler fails
      await pubsub.pub("error/test");

      assert.ok(errorThrown, "Error should have been thrown in failing handler");
      assert.ok(goodHandlerCalled, "Good handler should still be called despite other handler failing");
    });

    it("should continue processing other subscribers when one fails", async () => {
      let goodHandlerCalled = false;

      class MixedSubscribers {
        @sub("mixed/test")
        async failingHandler(_args: BasePubSubArgs): Promise<void> {
          throw new Error("This handler fails");
        }

        @sub("mixed/test")
        async goodHandler(_args: BasePubSubArgs): Promise<void> {
          goodHandlerCalled = true;
        }
      }

      new MixedSubscribers();

      const pubsub = BaseDi.resolve<BasePubSub>(BasePubSub);
      await pubsub.pub("mixed/test");

      assert.ok(goodHandlerCalled, "Good handler should still be called despite other handler failing");
    });
  });

  describe("Full DI Container Lifecycle", () => {
    it("should work with BasePubSub registered as singleton", async () => {
      // Create two different classes that subscribe
      let handler1Called = false;
      let handler2Called = false;

      class Service1 {
        @sub("shared/event")
        async handle(_args: BasePubSubArgs): Promise<void> {
          handler1Called = true;
        }
      }

      class Service2 {
        @sub("shared/event")
        async handle(_args: BasePubSubArgs): Promise<void> {
          handler2Called = true;
        }
      }

      // Instantiate both services
      new Service1();
      new Service2();

      // Both should use the same singleton BasePubSub instance
      const pubsub1 = BaseDi.resolve<BasePubSub>(BasePubSub);
      const pubsub2 = BaseDi.resolve<BasePubSub>(BasePubSub);
      
      assert.strictEqual(pubsub1, pubsub2, "Should return the same singleton instance");

      // Publishing should trigger both handlers
      await pubsub1.pub("shared/event");

      assert.ok(handler1Called, "First service handler should be called");
      assert.ok(handler2Called, "Second service handler should be called");
    });
  });
});
