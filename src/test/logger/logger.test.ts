import { expect } from "chai";

import * as sinon from "sinon";
import Logger from "../../logger";
import { getPrivate, matchIsoTimestamp, setPrivate } from "../_utils";
import { delay } from "../../utils/async";
import { LogLevel, SerializedLogMessage } from "../../logger/types";

describe("Logger", () => {
  let emitter: sinon.SinonSpy;
  let redactor: sinon.SinonSpy;
  let errorHandler: sinon.SinonSpy;
  const baseTags = ["tag1", "tag2"];
  beforeEach(() => {
    emitter = sinon.spy();
    redactor = sinon.spy((logMessage: SerializedLogMessage) => logMessage);
    errorHandler = sinon.spy();
    Logger.init();
    setPrivate(getPrivate(Logger, "_logEmitter"), "emit", emitter);
    setPrivate(getPrivate(Logger, "redactor"), "redact", redactor);
    setPrivate(Logger, "handleInternalError", errorHandler);
    setPrivate(Logger, "outputLogMessage", sinon.spy());
  });
  describe("when logging a message with log()", () => {
    describe("and the log level is below the threshold", () => {
      describe("and the log buffer is not overflowing", () => {
        it("should log the message with defaults", async () => {
          const logger = new Logger("test");
          logger.log("Test message");
          await delay();
          const msg = emitter.firstCall?.args ?? [];
          const logMessage = msg[1] ?? {};
          const ts = logMessage.timestamp;
          delete logMessage.timestamp;
          expect(logMessage).to.deep.equal({
            context: {},
            message: "Test message",
            tags: [],
            namespace: "test",
            level: "DEBUG",
          });
          expect(matchIsoTimestamp(ts)).to.be.true;
        });
        it("should log the message with specified tags", async () => {
          const logger = new Logger("test", baseTags);
          logger.log("Test message", ["tag3", "tag4"]);
          await delay();
          const msg = emitter.firstCall?.args ?? [];
          const logMessage = msg[1] ?? {};
          const ts = logMessage.timestamp;
          delete logMessage.timestamp;
          expect(logMessage).to.deep.equal({
            context: {},
            message: "Test message",
            tags: ["tag1", "tag2", "tag3", "tag4"],
            namespace: "test",
            level: "DEBUG",
          });
          expect(matchIsoTimestamp(ts)).to.be.true;
        });
        it("should log the message with specified level", async () => {
          const logger = new Logger("test", baseTags);
          logger.log("Test message", [], LogLevel.ERROR);
          await delay();
          const msg = emitter.firstCall?.args ?? [];
          const logMessage = msg[1] ?? {};
          const ts = logMessage.timestamp;
          delete logMessage.timestamp;
          expect(logMessage).to.deep.equal({
            context: {},
            message: "Test message",
            tags: ["tag1", "tag2"],
            namespace: "test",
            level: "ERROR",
          });
          expect(matchIsoTimestamp(ts)).to.be.true;
        });
        it("should log the message with provided context", async () => {
          const logger = new Logger("test", baseTags);
          logger.log("Test message", ["tag"], LogLevel.INFO, {
            context: "test",
          });
          await delay();
          const msg = emitter.firstCall?.args ?? [];
          const logMessage = msg[1] ?? {};
          const ts = logMessage.timestamp;
          delete logMessage.timestamp;
          expect(logMessage).to.deep.equal({
            context: { context: "test" },
            message: "Test message",
            tags: ["tag1", "tag2", "tag"],
            namespace: "test",
            level: "INFO",
          });
          expect(matchIsoTimestamp(ts)).to.be.true;
        });

        it("should redact the message", async () => {
          const logger = new Logger("test");
          logger.log("Test message", ["tag"], LogLevel.INFO, {
            context: "test",
          });
          await delay();
          expect(emitter.calledOnce).to.be.true;
          expect(redactor.calledOnce).to.be.true;
        });

        describe("if redaction is disabled", () => {
          beforeEach(() => {
            Logger.init({ redaction: false });
            setPrivate(getPrivate(Logger, "_logEmitter"), "emit", emitter);
            setPrivate(getPrivate(Logger, "redactor"), "redact", redactor);
          });
          it("should not redact the message", async () => {
            const logger = new Logger("test");
            logger.log("Test message");
            await delay();
            expect(emitter.calledOnce).to.be.true;
            expect(redactor.called).to.be.false;
          });
        });
      });
      describe("and the log buffer is overflowing", () => {
        beforeEach(() => {
          Logger.init();
          setPrivate(getPrivate(Logger, "_logEmitter"), "emit", emitter);
          setPrivate(Logger, "_inFlightLogs", 1100);
        });
        it("should drop the message and log an error", async () => {
          const logger = new Logger("test");
          logger.log("Test message");
          await delay();
          expect(emitter.calledOnce).to.be.false;
          expect(errorHandler.calledOnce).to.be.true;
          const msg = errorHandler.firstCall?.args ?? [];
          const error = msg[0] ?? new Error();
          const context = msg[1] ?? {};
          expect(context.message).to.equal("Test message");
          expect(error.message).to.equal("Log queue full. Message dropped.");
        });
      });
      describe("and the log buffer was overflowing", () => {
        beforeEach(() => {
          Logger.init();
          setPrivate(getPrivate(Logger, "_logEmitter"), "emit", emitter);
          setPrivate(Logger, "_inFlightLogs", 800);
          setPrivate(Logger, "_logLimitOverflow", true);
        });
        it("should reset the overflow flag and log the message", async () => {
          const logger = new Logger("test");
          logger.log("Test message");
          await delay();
          expect(getPrivate(Logger, "_logLimitOverflow")).to.be.false;
          expect(emitter.calledOnce).to.be.true;
        });
      });
    });
    describe("and the log level is above the threshold", () => {
      beforeEach(() => {
        Logger.init({ logLevel: LogLevel.ERROR });
        setPrivate(getPrivate(Logger, "_logEmitter"), "emit", emitter);
      });
      it("should drop the message", async () => {
        const logger = new Logger("test");
        logger.log("Test message");
        await delay();
        expect(emitter.calledOnce).to.be.false;
      });
    });
  });

  describe("when logging with the specific level method", () => {
    beforeEach(() => {
      Logger.init();
      setPrivate(getPrivate(Logger, "_logEmitter"), "emit", emitter);
    });
    it("debug() should log the message with the DEBUG level", async () => {
      const logger = new Logger("test");
      logger.debug("Test message");
      await delay();
      expect(emitter.calledOnce).to.be.true;
      const msg = emitter.firstCall?.args ?? [];
      const logMessage = msg[1] ?? {};
      expect(logMessage.level).to.equal("DEBUG");
    });
    it("info() should log the message with the INFO level", async () => {
      const logger = new Logger("test");
      logger.info("Test message");
      await delay();
      expect(emitter.calledOnce).to.be.true;
      const msg = emitter.firstCall?.args ?? [];
      const logMessage = msg[1] ?? {};
      expect(logMessage.level).to.equal("INFO");
    });
    it("warn() should log the message with the WARNING level", async () => {
      const logger = new Logger("test");
      logger.warn("Test message");
      await delay();
      expect(emitter.calledOnce).to.be.true;
      const msg = emitter.firstCall?.args ?? [];
      const logMessage = msg[1] ?? {};
      expect(logMessage.level).to.equal("WARNING");
    });
    it("error() should log the message with the ERROR level", async () => {
      const logger = new Logger("test");
      logger.error("Test message");
      await delay();
      expect(emitter.calledOnce).to.be.true;
      const msg = emitter.firstCall?.args ?? [];
      const logMessage = msg[1] ?? {};
      expect(logMessage.level).to.equal("ERROR");
    });
    it.skip("fatal() should log the message with the FATAL level", async () => {
      const logger = new Logger("test");
      logger.fatal("Test message");
      await delay();
      expect(emitter.calledOnce).to.be.true;
      const msg = emitter.firstCall?.args ?? [];
      const logMessage = msg[1] ?? {};
      expect(logMessage.level).to.equal("FATAL");
    });
  });
});
