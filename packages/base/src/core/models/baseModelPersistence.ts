/**
 * BaseModelPersistence - Persistence and Event Layer
 * 
 * Adds persistence operations and event publishing to the model.
 * This layer introduces the public save()/remove() API and event broadcasting.
 * 
 * Responsibilities:
 * - Type guards (isPersistable, isDeletable)
 * - Public persistence API (save, remove)
 * - Event topic generation and publishing
 * - Integration with BasePubSub for broadcasting model changes
 * 
 * Key Design:
 * - save() calls the internal _onPersist() hook
 * - remove() calls the internal _onDelete() hook
 * - Both publish events to notify subscribers of model changes
 * 
 * Inheritance: BaseModelCore → BaseModelRelations → BaseModelPersistence → BaseModel
 */

import { camelToKebab } from "../../utils/string.js";
import { di } from "../di/baseDi.js";
import { type BasePubSub } from "../pubsub/basePubSub.js";
import { BaseError } from "../baseErrors.js";
import { BaseModelRelations } from "./baseModelRelations.js";
import { UniqueID } from "./uniqueId.js";
import {
  type Persistable,
  type Deletable,
  type ModelEventType,
  type ModelEvent,
  type IBaseModel,
} from "./types.js";

/**
 * Persistence and event layer for models.
 * Provides save/remove operations and broadcasts events when models change.
 */
export abstract class BaseModelPersistence extends BaseModelRelations {
  @di("BasePubSub")
  accessor #pubSub!: BasePubSub;

  // =============================================================================
  // TYPE GUARDS
  // =============================================================================

  /**
   * Type guard to check if this model implements the Persistable interface.
   * Checks for the _onPersist method (internal persistence hook).
   */
  protected isPersistable(): this is this & Persistable {
    return typeof (this as unknown as Persistable)._onPersist === "function";
  }

  /**
   * Type guard to check if this model implements the Deletable interface.
   * Checks for the _onDelete method (internal deletion hook).
   */
  protected isDeletable(): this is this & Deletable {
    return typeof (this as unknown as Deletable)._onDelete === "function";
  }

  // =============================================================================
  // PUBLIC PERSISTENCE API
  // =============================================================================

  /**
   * Saves the model if it has unsaved changes.
   * Calls the _onPersist() hook, updates dirty state, and publishes events.
   * 
   * @throws {BaseError} If the model doesn't implement Persistable
   */
  public async save(): Promise<void> {
    // 1. Use the public 'dirty' getter (which already works)
    if (!this.dirty) {
      return; // Nothing to save
    }

    // 2. Check if the model can be persisted
    if (this.isPersistable()) {
      // 3. READ state using protected accessors from BaseModelCore
      const isNewModel = this.isNew();
      const eventType = isNewModel ? "create" : "update";
      
      // serialize() is defined in IBaseModel interface and implemented in BaseModelCore
      const dataForEvent = this.serialize();

      // 4. Perform the persistence hook
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      await (this as this & Persistable)._onPersist();

      // 5. WRITE state using protected accessors from BaseModelCore
      this.setDirty(false);
      this.setNew(false);
      // Lock in the new "original" state by snapshotting the current data
      this.setOriginalData({ ...this.getData() });

      // 6. Publish the *correct* event
      await this.publishDataEvent(eventType, dataForEvent);
      
    } else {
      // Throw if save() is called but the model isn't persistable
      throw new BaseError(
        `Model '${this.constructor.name}' does not implement the Persistable interface.`
      );
    }
  }

  /**
   * Removes the model from persistent storage.
   * Calls the _onDelete() hook, resets state, and publishes events.
   * 
   * @throws {BaseError} If the model doesn't implement Deletable
   */
  public async remove(): Promise<void> {
    if (this.isDeletable()) {
      const originalData = this.serialize();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      await (this as this & Deletable)._onDelete();
      
      // After successful deletion, reset the model and publish delete event
      this.reset(); // Inherited from BaseModelCore
      await this.publishDataEvent("delete", originalData);
    } else {
      throw new BaseError(
        `Model '${this.constructor.name}' does not implement the Deletable interface.`
      );
    }
  }

  // =============================================================================
  // EVENT PUBLISHING
  // =============================================================================

  /**
   * Generates the topic name for this model based on its class name.
   * Converts PascalCase to kebab-case (e.g., UserModel → user-model)
   */
  private getTopicName(): string {
    return camelToKebab(this.constructor.name);
  }

  /**
   * Gets the full event topic path for a specific event type.
   * Format: /models/{eventType}/{model-name}
   * 
   * @param event - The type of model event (create, update, delete)
   * @returns The full topic path
   */
  protected getEventTopic(event: ModelEventType): string {
    return `/models/${event}/${this.getTopicName()}`;
  }

  /**
   * Publishes a model data event to the pub/sub system.
   * Notifies subscribers when models are created, updated, or deleted.
   * 
   * @param type - The type of event (create, update, delete)
   * @param data - Optional serialized model data (defaults to current state)
   */
  private async publishDataEvent(
    type: ModelEventType,
    data?: Record<string, unknown>
  ): Promise<void> {
    const event: ModelEvent = {
      id: new UniqueID(),
      type,
      model: this as unknown as IBaseModel,
      data: data ?? this.serialize(),
    };
    await this.#pubSub.pub(this.getEventTopic(type), { event });
  }
}
