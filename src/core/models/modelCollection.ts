import { type BaseModel } from "./baseModel";
import { type ModelConstructor, type ModelData } from "./types";

/**
 * An abstract class that provides a framework for handling collections of model instances.
 *
 * This class is designed to be extended by data-source-specific collection handlers
 * (e.g., `MongoModelCollection`, `ElasticModelCollection`). It handles the common,
 * boilerplate logic of iterating over a raw data source and hydrating it into
 * fully-fledged model instances.
 *
 * The concrete subclass is only responsible for one thing: implementing the
 * `getSource()` method to provide the raw, iterable data from the underlying
 * database or API.
 *
 * @template T The type of `BaseModel` this collection will contain.
 */
export abstract class ModelCollection<T extends BaseModel<T>> implements AsyncIterable<T> {
  /**
   * The constructor for the model class this collection will produce.
   * This is stored so the collection knows how to instantiate new models during iteration.
   */
  protected readonly modelConstructor: ModelConstructor<T>;

  constructor(modelConstructor: ModelConstructor<T>) {
    this.modelConstructor = modelConstructor;
  }

  protected abstract getSource(): AsyncIterable<ModelData<T>>;

  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    // 1. Delegate to the concrete subclass to get the raw data source.
    const source = this.getSource();

    // 2. Iterate over the raw data source.
    for await (const data of source) {
      // 3. Create a new model instance pre-populated with data using the factory method.
      const instance = await this.modelConstructor.fromData(data);

      // 4. Yield the fully-formed model instance.
      yield instance;
    }
  }

  async toArray(): Promise<T[]> {
    const results: T[] = [];
    for await (const item of this) {
      results.push(item);
    }
    return results;
  }
}
