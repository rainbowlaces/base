import { test, describe, beforeEach, afterEach } from "node:test";
import { strictEqual, deepStrictEqual, ok } from "node:assert";

import { BaseModel } from "../../../../src/core/models/baseModel";
import { meta } from "../../../../src/core/models/decorators/meta";
import { field } from "../../../../src/core/models/decorators/field";
import { BaseDi } from "../../../../src/core/di/baseDi";
import { getMockPubSub } from "../../../testUtils/utils";
import { model } from "../../../../src/core/models/decorators/model";

// Extend the metadata interfaces for testing
declare module "../../../../src/core/models/types" {
  interface ModelMetadata {
    testCollection?: string;
    testConfig?: { enabled: boolean };
  }

  interface FieldMetadata {
    validation?: { required: boolean };
  }
}

describe("Basic Decorator Functionality", () => {
  let mockPubSub: ReturnType<typeof getMockPubSub>;

  beforeEach(async () => {
    BaseDi.reset();
    mockPubSub = getMockPubSub();
    BaseDi.register(mockPubSub, "BasePubSub");
  });

  afterEach(async () => {
    await BaseDi.teardown();
  });

  describe("@meta decorator", () => {
    test("sets model-level metadata correctly", () => {
      @meta("testCollection", "users")
      class TestModel extends BaseModel<TestModel> {}

      const schema = TestModel.getProcessedSchema();

      // Debug logging to understand what's happening
      console.log("Schema meta:", schema.meta);
      console.log("Test collection value:", schema.meta.testCollection);

      strictEqual(schema.meta.testCollection, "users");
    });

    test("supports multiple @meta decorators on same class", () => {
      @meta("testCollection", "orders")
      @meta("testConfig", { enabled: true })
      class MultiMetaModel extends BaseModel<MultiMetaModel> {}

      const schema = MultiMetaModel.getProcessedSchema();

      strictEqual(schema.meta.testCollection, "orders");
      deepStrictEqual(schema.meta.testConfig, { enabled: true });
    });

    test("handles undefined/null metadata values", () => {
      @meta("testCollection", undefined)
      class UndefinedMetaModel extends BaseModel<UndefinedMetaModel> {}

      const schema = UndefinedMetaModel.getProcessedSchema();

      strictEqual(schema.meta.testCollection, undefined);
    });
  });

  describe("@field decorator", () => {
    test("registers field metadata with extensible options", () => {
      @model
      class FieldTestModel extends BaseModel<FieldTestModel> {
        @field<string>({
          default: () => "test",
          validation: { required: true },
        })
        accessor name!: string;
      }

      const schema = FieldTestModel.getProcessedSchema();

      // Debug output to see what's in the schema
      console.log("Schema fields:", Object.keys(schema.fields));
      console.log("Full schema:", schema);

      ok("name" in schema.fields);
      strictEqual(typeof schema.fields.name.options.default, "function");
      strictEqual(schema.fields.name.options.default!(), "test");
      deepStrictEqual((schema.fields.name as any).validation, {
        required: true,
      });
    });

    test("supports basic field options", () => {
      @model
      class BasicFieldModel extends BaseModel<BasicFieldModel> {
        @field<string>({ readOnly: true })
        accessor readonly!: string;

        @field<number>({ default: () => 42 })
        accessor count!: number;
      }

      const schema = BasicFieldModel.getProcessedSchema();

      ok("readonly" in schema.fields);
      ok("count" in schema.fields);
      strictEqual(schema.fields.readonly.options.readOnly, true);
      strictEqual(schema.fields.count.options.default!(), 42);
    });
  });
});