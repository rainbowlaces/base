import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert";
import { BaseLogger } from "../../../src/core/logger/baseLogger.js";
import {
  LogLevel,
  type LogContext,
  type LoggerConfig,
  type LogObjectTransformer,
} from "../../../src/core/logger/types.js";
import { type ConfigData } from "../../../src/core/config/types.js";
import { type Console } from "../../../src/utils/console.js";
import { BaseDi } from "../../../src/core/di/baseDi.js";
import { ErrorSerializer } from "../../../src/core/logger/transformers/errorSerializer.js";

function setLoggerConfig(config: ConfigData<LoggerConfig>): void {
  BaseDi.register(config, { key: "Config.BaseLogger", singleton: true, type: "scalar" });
}

describe("BaseLogger", () => {
  const testContext: LogContext = { requestId: "123", userId: "user456" };

  // Mock console to capture output
  let consoleLogs: { method: string; args: unknown[] }[] = [];
  let processExitCalled = false;
  let originalProcessExit: (() => never) | undefined;

  // Mock Console implementation
  const mockConsole: Console = {
    log: (...args) => consoleLogs.push({ method: "log", args }),
    error: (...args) => consoleLogs.push({ method: "error", args }),
    warn: (...args) => consoleLogs.push({ method: "warn", args }),
    debug: (...args) => consoleLogs.push({ method: "debug", args }),
    trace: (...args) => consoleLogs.push({ method: "trace", args }),
  };

  // Helper to safely parse console output as JSON
  const parseLogOutput = (logEntry: { method: string; args: unknown[] }) => {
    return JSON.parse(logEntry.args[0] as string);
  };

  beforeEach(async () => {
    // Clear any existing console logs and setup mocks
    consoleLogs = [];
    processExitCalled = false;

    // Mock process.exit
     
    originalProcessExit = process.exit;
    process.exit = (() => {
      processExitCalled = true;
    }) as unknown as typeof process.exit;

    // Register dependencies in DI
    const config: ConfigData<LoggerConfig> = { logLevel: LogLevel.INFO, redaction: false };
    setLoggerConfig(config);
  });

  afterEach(async () => {
    // Restore process.exit
    if (originalProcessExit) {
      process.exit = originalProcessExit as typeof process.exit;
    }

    // Clean up DI
    BaseDi.reset(); 
  });

  describe("constructor", () => {
    it("should create logger with namespace and base tags", () => {
      const logger = new BaseLogger(
        "TestModule",
        ["tag1", "tag2"],
        mockConsole
      );

      assert.ok(logger instanceof BaseLogger);
    });

    it("should handle camelCase namespace conversion", () => {
      const logger = new BaseLogger("TestModuleName", [], mockConsole);
      logger.info("test message");
      assert.strictEqual(logger.namespace, "test_module_name");
    });

    it("should use empty base tags when not provided", () => {
      const logger = new BaseLogger("TestModule", [], mockConsole);
      logger.info("test message");
      assert.deepStrictEqual(logger.baseTags, []);
    });

    it("should use base tags when provided", () => {
      const logger = new BaseLogger("TestModule", ['some_tag'], mockConsole);
      logger.info("test message");
      assert.deepStrictEqual(logger.baseTags, ['some_tag']);
    });
  });

  describe("log level filtering", () => {
    beforeEach(async () => {
      // Clean up first and clear console logs for each test in this group
      BaseDi.reset();
      consoleLogs = [];
    });

    it("should filter out logs below configured level", async () => {
      const config: ConfigData<LoggerConfig> = {
        logLevel: LogLevel.WARNING, 
        redaction: false,
      };
      setLoggerConfig(config);

      const logger = new BaseLogger("TestModule", [], mockConsole);

      logger.trace("trace message"); // Will be filtered
      logger.debug("debug message"); // Will be filtered
      logger.info("info message"); // Will be filtered
      logger.warn("warning message"); // Will pass
      logger.error("error message"); // Will pass

      // The test expects 2 logs, and with the corrected mask, it will get 2.
      assert.strictEqual(consoleLogs.length, 2);

      const warnOutput = parseLogOutput(consoleLogs[0]);
      const errorOutput = parseLogOutput(consoleLogs[1]);

      assert.strictEqual(warnOutput.level, "WARNING");
      assert.strictEqual(errorOutput.level, "ERROR");
    });

    it("should log all messages when level is TRACE", async () => {
      // To see all levels, you must set log level to TRACE.
      const config: ConfigData<LoggerConfig> = {
        logLevel: LogLevel.TRACE,
        redaction: false,
      };
      setLoggerConfig(config);

      const logger = new BaseLogger("TestModule", [], mockConsole);

      logger.trace("trace message");
      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warning message");
      logger.error("error message");

      // Now it will get all 5.
      assert.strictEqual(consoleLogs.length, 5);
    });
  });

  describe("log methods", () => {
    beforeEach(async () => {
      // Clean up first and clear console logs for each test in this group
      BaseDi.reset();
      consoleLogs = [];

      // Use a mask that includes all levels for these tests.
      const allLevels = LogLevel.FATAL | LogLevel.ERROR | LogLevel.WARNING | LogLevel.INFO | LogLevel.DEBUG | LogLevel.TRACE;
      const config: ConfigData<LoggerConfig> = { 
        logLevel: allLevels, 
        redaction: false 
      };
      BaseDi.register(config, "Config.BaseLogger");

      // Register ErrorSerializer for tests that need it
      BaseDi.register(new ErrorSerializer(), {
        key: "ErrorSerializer",
        tags: new Set(["Logger:Serializer"]),
      });
    });

    it("fatal() should log and exit process", () => {
      const logger = new BaseLogger("TestModule", ["baseTag"], mockConsole);
      logger.fatal("fatal message", ["fatalTag"], testContext);

      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, "error");
      assert.strictEqual(processExitCalled, true);

      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.strictEqual(logOutput.level, "FATAL");
      assert.strictEqual(logOutput.message, "fatal message");
      assert.deepStrictEqual(logOutput.tags, ["baseTag", "fatalTag"]);
      assert.deepStrictEqual(logOutput.context, testContext);
    });

    it("error() should handle string messages", () => {
      const logger = new BaseLogger("TestModule", ["baseTag"], mockConsole);
      logger.error("error message", ["errorTag"], testContext);

      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, "error");
      assert.strictEqual(processExitCalled, false);

      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.strictEqual(logOutput.level, "ERROR");
      assert.strictEqual(logOutput.message, "error message");
    });

    it("error() should handle Error objects", () => {
      const testError = new Error("Test error message");
      testError.stack = "Error: Test error message\n    at test";

      const logger = new BaseLogger("TestModule", ["baseTag"], mockConsole);
      logger.error(testError, ["errorTag"], testContext);

      assert.strictEqual(consoleLogs.length, 1);
      const logOutput = parseLogOutput(consoleLogs[0]);

      assert.strictEqual(logOutput.message, "Test error message");
      assert.ok(logOutput.context.error);
      assert.strictEqual(logOutput.context.error.message, "Test error message");
    });

    it("warn() should use console.warn", () => {
      const logger = new BaseLogger("TestModule", ["baseTag"], mockConsole);
      logger.warn("warning message", ["warnTag"], testContext);

      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, "warn");

      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.strictEqual(logOutput.level, "WARNING");
    });

    it("info() should use console.log", () => {
      const logger = new BaseLogger("TestModule", ["baseTag"], mockConsole);
      logger.info("info message", ["infoTag"], testContext);

      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, "log");

      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.strictEqual(logOutput.level, "INFO");
    });

    it("debug() should use console.debug", () => {
      const logger = new BaseLogger("TestModule", ["baseTag"], mockConsole);
      logger.debug("debug message", ["debugTag"], testContext);

      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, "debug");

      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.strictEqual(logOutput.level, "DEBUG");
    });

    it("trace() should use console.trace", () => {
      const logger = new BaseLogger("TestModule", ["baseTag"], mockConsole);
      logger.trace("trace message", ["traceTag"], testContext);

      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, "trace");

      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.strictEqual(logOutput.level, "TRACE");
    });
  });

  describe("tag merging", () => {
    it("should combine base tags with method tags", () => {
      const logger = new BaseLogger(
        "TestModule",
        ["baseTag1", "baseTag2"],
        mockConsole
      );
      logger.info("test message", ["methodTag1", "methodTag2"]);

      assert.strictEqual(consoleLogs.length, 1);
      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.deepStrictEqual(logOutput.tags, [
        "baseTag1",
        "baseTag2",
        "methodTag1",
        "methodTag2",
      ]);
    });
  });

  describe("formatting error handling", () => {
    beforeEach(async () => {
      // Clean up first and clear console logs for each test in this group
      BaseDi.reset();
      consoleLogs = [];
    });

    it("should catch formatting errors and log raw message", async () => {
      // Create a problematic transformer that throws
      const badTransformer: LogObjectTransformer = {
        priority: 1,
        canTransform: () => true,
        transform: () => {
          throw new Error("Transformer error");
        },
      };

      // Register with redaction enabled and problematic redactor
      const config: ConfigData<LoggerConfig> = { logLevel: LogLevel.INFO, redaction: true };
      BaseDi.register(config, "Config.BaseLogger");
      BaseDi.register(badTransformer, {
        key: "BadRedactor",
        tags: new Set(["Logger:Redactor"]),
      });

      const logger = new BaseLogger("TestModule", [], mockConsole);
      logger.info("test message", [], testContext);

      // Should have logged the error to console.error
      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, "error");
      const errorMessage = consoleLogs[0].args[0] as string;
      assert.ok(errorMessage.includes("LOGGER FORMATTING ERROR"));
    });
  });
});
