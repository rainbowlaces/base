import { expect } from "chai";
import LogMessageSerializerDefault from "../../logger/logMessageSerializer";
import { LogMessage } from "../../logger/logMessage";
import { LogLevel } from "../../logger/types";

describe("LogMessageSerializerDefault", () => {
  let serializer: LogMessageSerializerDefault;

  beforeEach(() => {
    serializer = new LogMessageSerializerDefault();
  });

  describe("when initialized with defaults", () => {
    beforeEach(() => {
      serializer.init({});
    });

    describe("and the message is over > maxMessageLenth", () => {
      it("should truncate the message", () => {
        const message: LogMessage = LogMessage.create(
          "X".repeat(2000),
          "test",
          ["tag"],
          LogLevel.DEBUG,
          {},
        );

        const serialized = serializer.serialize(message);
        expect(serialized.message).to.equal(`${"X".repeat(1013)}[TRUNCATED]`);
      });
    });

    describe("and the message is < maxMessageLenth", () => {
      it("should not truncate the message", () => {
        const message: LogMessage = LogMessage.create(
          "X".repeat(1000),
          "test",
          ["tag"],
          LogLevel.DEBUG,
          {},
        );

        const serialized = serializer.serialize(message);
        expect(serialized.message).to.equal(`${"X".repeat(1000)}`);
      });
    });

    describe("when context has a circular reference", () => {
      it("should handle circular references without breaking", () => {
        const thing: any = { a: "a thing" };
        const anotherThing: any = { b: "b thing" };
        anotherThing.c = thing;
        thing.d = anotherThing;

        const message: LogMessage = LogMessage.create(
          "test",
          "test",
          ["tag"],
          LogLevel.DEBUG,
          { thing, anotherThing },
        );

        const serialized = serializer.serialize(message);

        //@ts-expect-error - testing for circular reference
        expect(serialized.context.thing.d).to.equal(
          serialized.context.anotherThing,
        );
      });
    });

    describe("when context has a scalar property > maxMessageLength", () => {
      it("should truncate the property", () => {
        const context = {
          a: "X".repeat(2000),
          b: {
            c: "X".repeat(2000),
          },
        };

        const message: LogMessage = LogMessage.create(
          "test",
          "test",
          ["tag"],
          LogLevel.DEBUG,
          context,
        );

        const serialized = serializer.serialize(message);

        expect(serialized.context).to.deep.equal({
          a: `${"X".repeat(1013)}[TRUNCATED]`,
          b: {
            c: `${"X".repeat(1013)}[TRUNCATED]`,
          },
        });
      });
    });
  });

  describe("when context has more than maxContextDepth", () => {
    beforeEach(() => {
      serializer.init({ maxContextDepth: 1 });
    });
    it("should truncate the context", () => {
      const message: LogMessage = LogMessage.create(
        "test",
        "test",
        ["tag"],
        LogLevel.DEBUG,
        {
          a: {
            b: {
              c: "some thing deep",
              d: { e: "deeper" },
            },
          },
        },
      );

      const serialized = serializer.serialize(message);

      expect(serialized.context).to.deep.equal({
        a: {},
      });
    });
  });

  describe("when context has more than maxItemsPerLevel", () => {
    beforeEach(() => {
      serializer.init({ maxItemsPerLevel: 2 });
    });
    it("should truncate the context", () => {
      const message: LogMessage = LogMessage.create(
        "test",
        "test",
        ["tag"],
        LogLevel.DEBUG,
        {
          a: {
            b: [1, 2, 3, 4, 5, 6, 7, 8],
            c: {
              d: 1,
              e: 2,
              f: 3,
              g: 4,
            },
          },
        },
      );

      const serialized = serializer.serialize(message);

      expect(serialized.context).to.deep.equal({
        a: {
          b: [1, 2],
          c: {
            d: 1,
            e: 2,
          },
        },
      });
    });
  });
});
