# `BasePubSub`: The Asynchronous Event Bus

This document provides a deep dive into the framework's Publish/Subscribe (Pub/Sub) system. `BasePubSub` is the core event bus that enables decoupled, asynchronous communication between different modules and services. It is fundamental to the framework's operation, orchestrating everything from module initialization to complex request-response cycles.

## Core Philosophy

The Pub/Sub system is designed with the following principles in mind:

1.  **Decoupling**: Publishers and subscribers do not need to know about each other. A module can publish an event (e.g., `'/user/created'`) without knowing which other modules, if any, are listening. This is essential for a modular architecture.
2.  **Asynchronicity**: The system is fully asynchronous and non-blocking. A publisher can fire an event and continue its work immediately, without waiting for subscribers to complete their tasks.
3.  **Pattern-Based Subscriptions**: Subscriptions are not limited to exact topic strings. The system leverages the standard `URLPattern` API to allow for powerful, flexible topic matching with wildcards and named parameters (e.g., `'/users/:id/update'`).
4.  **DI Integration**: The `BasePubSub` service is a singleton managed by the DI container, and the primary way to create subscriptions is through the clean, declarative `@sub` decorator.

## Core Components

The system is composed of a central service, a primary decorator, and a few key types.

| Component | File(s) | Role |
| :--- | :--- | :--- |
| **`BasePubSub`** | `basePubSub.ts` | The central, singleton service that manages all subscriptions and handles the publishing of messages. |
| **`@sub`** | `decorators/sub.ts` | A method decorator that subscribes a class method to a specific topic pattern. |
| **`Subscription`** | `types.ts` | An interface defining the internal data structure for a single subscription, containing its topic, handler, and a pre-compiled `URLPattern`. |
| **`BasePubSubArgs`** | `types.ts` | The base interface for the payload object passed to all subscriber methods. |

## The Pub/Sub Lifecycle

### 1\. Subscription

A component subscribes to a topic primarily using the **`@sub`** decorator.

```typescript
// In some service class
@sub('/users/:id/updated')
async function onUserUpdate(args: BasePubSubArgs & { id: string }) {
    this.logger.info(`User with ID ${args.id} was updated.`);
}
```

Here's what happens behind the scenes when the application starts:

1.  **Autoloading**: `BaseAutoload` imports the file containing the service.
2.  **Decorator Execution**: As the class is defined, the `@sub` decorator's logic is attached.
3.  **Class Initialization**: When an instance of the service is created by the DI container, the decorator's `addInitializer` function runs.
4.  **Registration**: The initializer function resolves the singleton `BasePubSub` instance from the `BaseDi` container. It then calls `pubsub.sub('/users/:id/updated', this.onUserUpdate.bind(this))`.
5.  **`Subscription` Object Creation**: The `sub()` method in `BasePubSub` creates a `Subscription` object. Crucially, it pre-compiles the topic string into a `URLPattern` object (`new URLPattern({ pathname: '/users/:id/updated' })`). This is a performance optimization that avoids re-parsing the pattern for every published message.
6.  **Storage**: This new `Subscription` object is added to the `BasePubSub`'s internal `subscriptions` `Set`.

### 2\. Publication

Another part of the application, the publisher, injects `BasePubSub` and calls the `pub()` method.

```typescript
// In another service
@di(BasePubSub) private accessor pubsub!: BasePubSub;

async updateUser(userId: string, data: object) {
    //... update logic...
    await this.pubsub.pub(`/users/${userId}/updated`, { updateData: data });
}
```

The `pub()` method orchestrates the message delivery:

1.  **Filtering (`filterSubs`)**: The `pub()` method immediately calls the private `filterSubs()` method with the topic string (e.g., `'/users/xyz123/updated'`).
2.  **Pattern Matching**: `filterSubs()` iterates through every `Subscription` object in its `subscriptions` set. For each one, it uses the pre-compiled `URLPattern` to test for a match against the published topic.
      * `subscription.pattern.exec({ pathname: '/users/xyz123/updated' })`
3.  **Parameter Extraction**: If a pattern matches, `URLPattern` also extracts any named parameters. In this case, it would produce a result containing the group `{ id: 'xyz123' }`.
4.  **Asynchronous Execution**: The `pub()` method receives a list of all matching subscriptions and their extracted parameters. It then iterates through this list and invokes each subscriber's handler function asynchronously. The payload passed to the handler is a combination of the original arguments from `pub()` and the parameters extracted from the topic string.
5.  **Fire and Forget**: The call to the handler is wrapped in a `.catch()` to handle any errors, but it is not `await`-ed by the publisher. The `pub()` method resolves as soon as all the handler calls have been initiated, not when they have completed. This makes the system non-blocking.

## Key Features and Patterns

### `URLPattern` Matching

The use of `URLPattern` is the system's most powerful feature. It allows for flexible and expressive topic routing.

  * **Named Parameters**: `'/resource/:id'` will match `'/resource/123'` and provide `{ id: '123' }` in the arguments.
  * **Wildcards**: `'/resource/*'` will match `'/resource/foo'` and `'/resource/foo/bar'`.
  * **Optional Groups**: `'/resource/:id?'` will match both `'/resource/'` and `'/resource/123'`.

This is used extensively by the `BaseContext` system to route execution and status messages. For example, a subscription to `'/context/execute/:module/:action'` allows a module to listen for execution requests targeted specifically at it.

### Lifecycle Management

`BasePubSub` is registered in the DI container as a singleton with `setup: true` and `teardown: true` at `phase: 30`. This ensures:

  * It is one of the first core services to be initialized.
  * It persists for the entire application lifecycle.
  * During shutdown (`BaseDi.teardown()`), its `teardown()` method is called, which clears all subscriptions, preventing memory leaks in environments that support hot-reloading.

## How to Use

### Publishing an Event

Inject `BasePubSub` and call `pub()`.

```typescript
import { di, BasePubSub, BaseModule, baseModule } from '../../index.js';

@baseModule
export class OrderService extends BaseModule {
    @di(BasePubSub)
    private accessor pubsub!: BasePubSub;

    async placeOrder(orderId: string, items: string) {
        //... logic to place order...
        this.logger.info(`Order ${orderId} placed.`);

        // Announce that a new order has been placed
        await this.pubsub.pub('/orders/new', { orderId, items });
    }
}
```

### Subscribing to an Event

In a separate, decoupled service, use the `@sub` decorator on a method.

```typescript
import { sub, BasePubSubArgs, BaseModule, baseModule } from '../../index.js';

@baseModule
export class NotificationService extends BaseModule {

    @sub('/orders/new')
    async onNewOrder(args: BasePubSubArgs & { orderId: string, items: string }) {
        this.logger.info(`Sending notification for new order: ${args.orderId}`);
        //... logic to send an email or push notification...
    }

    @sub('/orders/:id/shipped')
    async onOrderShipped(args: BasePubSubArgs & { id: string, trackingNumber: string }) {
        this.logger.info(`Order ${args.id} has shipped with tracking: ${args.trackingNumber}`);
        //... logic to notify customer...
    }
}
```

In this example, `OrderService` and `NotificationService` know nothing about each other. They only communicate through the central `BasePubSub` event bus, making the system highly modular and easy to extend.