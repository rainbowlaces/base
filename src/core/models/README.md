# `BaseModel`: The Data Modeling and Persistence Abstraction Layer

This document provides a deep dive into the framework's data modeling system. This layer provides a powerful, decorator-driven, ORM-like interface for defining, manipulating, and persisting data. Its core purpose is to completely abstract the underlying database technology, allowing developers to work with rich, interconnected data models while the framework handles the complexities of storage and retrieval.

## Core Philosophy

The `BaseModel` system is built on these key principles:

1.  **Persistence Agnosticism**: The core model definitions are completely independent of the database. Business logic interacts with a uniform API (`save()`, `remove()`, `User.byId()`), while the actual storage mechanism (e.g., In-Memory, MongoDB, SQL) is implemented in a swappable base class.
2.  **Decorator-Driven Definition**: Model schemas, fields, and relationships are defined using intuitive TypeScript decorators (`@model`, `@field`, `@reference`, `@embed`), making model classes clean and declarative.
3.  **Type Safety**: The system is designed to be type-safe from end to end. Decorators, model data types (`ModelData<T>`), and relationship accessors are all strongly typed to improve developer experience and reduce runtime errors.
4.  **Rich Relationship Management**: The framework provides first-class support for both "by-reference" (lazy-loaded) and "embedded" (document-style) relationships, for both one-to-one and one-to-many cardinalities.
5.  **Solving Circular Dependencies**: Through the use of a `thunk()` utility, the system elegantly solves the classic problem of circular dependencies between model definitions (e.g., `User` has `Article`s, `Article` has an `author` `User`).

## Core Components

The system is composed of several key classes and a suite of decorators.

| Component | File(s) | Role |
| :--- | :--- | :--- |
| **`BaseModel`** | `baseModel.ts` | The abstract foundation for all models. Manages internal state (dirty tracking), schema registration, and persistence/event-publishing logic. |
| **`BaseIdentifiableModel`** | `baseIdentifiableModel.ts` | A practical base class that extends `BaseModel` with a `UniqueID` field and defines the contract for query methods (`byId`, `byIds`). |
| **`BaseModelCollection`** | `baseModelCollection.ts` | A generic, lazy-loading collection class for handling one-to-many relationships. It only materializes models from data as it's iterated over. |
| **`UniqueID`** | `uniqueId.ts` | A custom class for creating and validating time-sortable, globally unique identifiers, used as the default primary key for models. |
| **Decorators** | `decorators/*.ts` | The declarative API (`@model`, `@field`, `@reference`, `@embed`, `@meta`) for defining a model's structure and metadata. |
| **Types** | `types.ts` | Contains all the core interfaces and type definitions, such as `Persistable`, `Deletable`, `RefOne<T>`, `EmbedMany<T>`, and `ModelData<T>`. |

## The `BaseModel` Lifecycle and Mechanics

### 1\. Schema Definition: The "Attach and Collect" Pattern

A model's schema is not defined in a single large object but is built declaratively using decorators. This works via a two-stage "Attach and Collect" process.

  * **Attach**: Decorators like **`@field`**, **`@reference`**, and **`@embed`** are accessor decorators. When applied to a property, they don't directly modify the class. Instead, they create a metadata object describing the field (its name, options, relationship type, etc.) and attach it to the accessor's `getter` function using a unique `Symbol` (`FIELD_METADATA_SYMBOL`).
  * **Collect**: The **`@model`** class decorator runs last. Its job is to finalize the schema. It iterates up the prototype chain of the class, inspecting all property descriptors. It looks for the `FIELD_METADATA_SYMBOL` on the accessors, "collects" all the attached metadata, and uses it to populate a static `BaseModelSchema` object on the model's constructor.

This pattern ensures that each model class has its own isolated schema, correctly inheriting and extending the schemas of its parent classes without cross-contamination.

### 2\. Persistence: The `Persistable` and `Deletable` Contract

`BaseModel` itself does not know how to save to a database. Instead, it defines a contract.

  * The `save()` method checks if the model instance is `Persistable` (i.e., has a `persist(): Promise<void>` method). If so, it calls `this.persist()`.
  * The `remove()` method checks if the model instance is `Deletable` (i.e., has a `delete(): Promise<void>` method). If so, it calls `this.delete()`.

This is the key to the system's persistence agnosticism. A developer makes a model storable in a specific database by having it extend a class that correctly implements these methods.

### 3\. Relationships: References vs. Embeds

The framework provides two distinct ways to model relationships, managed by function-like accessors.

#### `@reference(Model, { cardinality: 'one' | 'many' })`

This decorator is for **lazy-loaded relationships**, similar to foreign keys in a relational database.

  * **Storage**: It only stores the `UniqueID` (or an array of `UniqueID`s) of the related model(s) in the parent's data.
  * **Accessor**: It creates a function-like property.
      * **Setter**: `await user.bookmarks([article1, article2])` resolves the models to their IDs and stores the array of IDs.
      * **Getter**: `const bookmarks = await user.bookmarks()` calls the static `Article.byIds()` method, fetching the full models from their data source on-demand.
  * **Use Case**: Ideal for many-to-many relationships or when related data is not always needed, preventing the need to load large object graphs.

#### `@embed(Model, { cardinality: 'one' | 'many' })`

This decorator is for **embedded documents**, common in NoSQL databases.

  * **Storage**: It stores the *full, serialized data* of the child model(s) as a sub-object or an array of sub-objects within the parent's data.
  * **Accessor**: It also creates a function-like property.
      * **Setter**: `await article.comments([comment1, comment2])` serializes each `Comment` instance and stores the resulting array of plain objects.
      * **Getter**: `const comments = await article.comments()` takes the raw object data stored on the `Article` and hydrates it into a `BaseModelCollection` of `Comment` instances on the fly.
  * **Use Case**: Ideal for tightly-coupled one-to-many relationships where the child entities have no independent existence (e.g., comments on a blog post).

## How to Create a New Model

Here is a practical example of creating `User` and `Article` models that reference each other.

#### Step 1: Choose a Persistence Strategy

First, decide how the model will be stored. For this example, we'll assume a `MemoryModel` class exists (as in the test application) which extends `BaseIdentifiableModel` and implements the `Persistable` and `Deletable` interfaces.

#### Step 2: Define the `User` Model

```typescript
// src/models/user.ts
import { model, field, reference, thunk, type RefMany } from '../core/models';
import { MemoryModel } from '../data/memoryModel'; // Our persistence strategy
import { Article } from './article.js'; // We will create this next

@model // 4. Finalize the model and register with DI
export class User extends MemoryModel { // 1. Extend the persistence strategy
    // 2. Define simple fields
    @field()
    accessor name!: string;

    @field()
    accessor email!: string;

    // 3. Define a relationship. Use thunk() to avoid a circular import error with Article.
    @reference(thunk(() => Article), { cardinality: "many" })
    accessor articles!: RefMany<Article>;
}
```

#### Step 3: Define the `Article` Model

```typescript
// src/models/article.ts
import { model, field, reference, thunk, type RefOne } from '../core/models';
import { MemoryModel } from '../data/memoryModel';
import { User } from './user.js';

@model
export class Article extends MemoryModel {
    @field()
    accessor title!: string;

    @field()
    accessor content!: string;

    // A reference back to the author.
    @reference(thunk(() => User), { cardinality: 'one' })
    accessor author!: RefOne<User>;
}
```

#### Step 4: Use the Models

Now, other services can use these models without any knowledge of the `MemoryModel` implementation.

```typescript
// In some service...
const user = new User();
await user.setData({ name: 'Alice', email: 'alice@example.com' });
await user.save(); // Calls MemoryModel.persist()

const article = new Article();
await article.setData({ title: 'My First Post', content: '...' });
await article.author(user); // Sets the reference to Alice's ID
await article.save(); // Calls MemoryModel.persist()

// Later, to retrieve the data...
const fetchedArticle = await Article.byId(article.id);
if (fetchedArticle) {
    const author = await fetchedArticle.author(); // Lazy-loads the User model
    console.log(author.name); // "Alice"
}
```

## Supporting Multiple Persistence Layers

The framework's architecture makes it straightforward to support different databases in parallel within the same application. This is achieved by creating different base model classes that implement the persistence contract.

**Example Scenario**: We want `User` and `Article` to be stored in MongoDB, but `Session` data to be stored in Redis.

1.  **Create `MongoModel.ts`**:

    ```typescript
    import { BaseIdentifiableModel, Persistable, Deletable } from '../core/models';
    // Assume getMongoCollection is a utility that returns a MongoDB collection object
    import { getMongoCollection } from '../db/mongo';

    export abstract class MongoModel extends BaseIdentifiableModel implements Persistable, Deletable {
        protected getCollectionName(): string {
            return this.constructor.name.toLowerCase() + 's';
        }

        async persist(): Promise<void> {
            const collection = getMongoCollection(this.getCollectionName());
            const data = this.serialise();
            await collection.updateOne({ _id: this.id.toString() }, { $set: data }, { upsert: true });
        }

        async delete(): Promise<void> {
            const collection = getMongoCollection(this.getCollectionName());
            await collection.deleteOne({ _id: this.id.toString() });
        }

        static async byId<T extends BaseIdentifiableModel>(this: ModelConstructor<T>, id): Promise<T | undefined> {
            //... implementation to find by ID in MongoDB...
        }
    }
    ```

2.  **Create `RedisModel.ts`**:

    ```typescript
    import { BaseIdentifiableModel, Persistable, Deletable } from '../core/models';
    // Assume redisClient is an initialized Redis client
    import { redisClient } from '../db/redis';

    export abstract class RedisModel extends BaseIdentifiableModel implements Persistable, Deletable {
        async persist(): Promise<void> {
            const key = `${this.constructor.name}:${this.id.toString()}`;
            await redisClient.set(key, JSON.stringify(this.serialise()));
        }

        async delete(): Promise<void> {
            const key = `${this.constructor.name}:${this.id.toString()}`;
            await redisClient.del(key);
        }

        static async byId<T extends BaseIdentifiableModel>(this: ModelConstructor<T>, id): Promise<T | undefined> {
            //... implementation to GET from Redis...
        }
    }
    ```

3.  **Update Model Definitions**: Simply change the `extends` clause in the model definitions.

    ```typescript
    // user.ts
    import { MongoModel } from '../data/mongoModel';
    @model
    export class User extends MongoModel { /*...fields... */ }

    // article.ts
    import { MongoModel } from '../data/mongoModel';
    @model
    export class Article extends MongoModel { /*...fields... */ }

    // session.ts
    import { RedisModel } from '../data/redisModel';
    @model
    export class Session extends RedisModel { /*...fields... */ }
    ```

The application's service layer, which calls `user.save()` or `session.save()`, requires **zero changes**. It remains completely decoupled from the underlying storage, demonstrating the power and flexibility of this architectural pattern.