import { test } from 'node:test';
import * as assert from 'node:assert';
import { BaseLogger } from '../../../src/core/logger/baseLogger';
import { LogLevel, type LogContext, type LoggerConfig, type LogObjectTransformer } from '../../../src/core/logger/types';
import { type Console } from '../../../src/core/logger/console';

test('BaseLogger', (t) => {
  const testContext: LogContext = { requestId: '123', userId: 'user456' };
  
  // Mock console to capture output
  let consoleLogs: { method: string; args: unknown[] }[] = [];
  let processExitCalled = false;
  let originalProcessExit: (() => never) | undefined;

  // Mock Console implementation
  const mockConsole: Console = {
    log: (...args) => consoleLogs.push({ method: 'log', args }),
    error: (...args) => consoleLogs.push({ method: 'error', args }),
    warn: (...args) => consoleLogs.push({ method: 'warn', args }),
    debug: (...args) => consoleLogs.push({ method: 'debug', args }),
    trace: (...args) => consoleLogs.push({ method: 'trace', args })
  };

  // Helper to safely parse console output as JSON
  const parseLogOutput = (logEntry: { method: string; args: unknown[] }) => {
    return JSON.parse(logEntry.args[0] as string);
  };

  // Helper to create a logger with common defaults
  const createLogger = (
    namespace: string,
    config: LoggerConfig,
    baseTags: string[] = []
  ) => {
    return new BaseLogger(
      namespace,
      config,
      mockConsole,
      [], // serializers
      [], // redactors
      baseTags
    );
  };

  t.beforeEach(async () => {
    // Clear any existing console logs and setup mocks
    consoleLogs = [];
    processExitCalled = false;

    // Mock process.exit
    // eslint-disable-next-line @typescript-eslint/unbound-method
    originalProcessExit = process.exit;
    process.exit = ((() => { processExitCalled = true; }) as unknown) as typeof process.exit;
  });

  t.afterEach(async () => {
    // Restore process.exit
    if (originalProcessExit) {
      process.exit = originalProcessExit as typeof process.exit;
    }
  });

  t.test('constructor', (t) => {
    t.test('should create logger with namespace and base tags', () => {
      const config: LoggerConfig = { logLevel: LogLevel.INFO, redaction: false };
      const logger = createLogger('TestModule', config, ['tag1', 'tag2']);
      
      assert.ok(logger instanceof BaseLogger);
    });

    t.test('should handle camelCase namespace conversion', () => {
      const config: LoggerConfig = { logLevel: LogLevel.INFO, redaction: false };
      const logger = createLogger('TestModuleName', config);
      logger.info('test message');
      
      assert.strictEqual(consoleLogs.length, 1);
      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.strictEqual(logOutput.namespace, 'test_module_name');
    });

    t.test('should use empty base tags when not provided', () => {
      const config: LoggerConfig = { logLevel: LogLevel.INFO, redaction: false };
      const logger = createLogger('TestModule', config);
      logger.info('test message');
      
      assert.strictEqual(consoleLogs.length, 1);
      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.deepStrictEqual(logOutput.tags, []);
    });
  });

  t.test('log level filtering', (t) => {
    t.test('should filter out logs below configured level', () => {
      const config: LoggerConfig = { logLevel: LogLevel.WARNING, redaction: false };
      const logger = createLogger('TestModule', config);
      
      logger.trace('trace message');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warning message');
      logger.error('error message');
      
      // Only WARNING and ERROR should be logged (levels 4 and 2, both <= 4)
      assert.strictEqual(consoleLogs.length, 2);
      
      const warnOutput = parseLogOutput(consoleLogs[0]);
      const errorOutput = parseLogOutput(consoleLogs[1]);
      
      assert.strictEqual(warnOutput.level, 'WARNING');
      assert.strictEqual(errorOutput.level, 'ERROR');
    });

    t.test('should log all messages when level is TRACE', () => {
      const config: LoggerConfig = { logLevel: LogLevel.TRACE, redaction: false };
      const logger = createLogger('TestModule', config);
      
      logger.trace('trace message');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warning message');
      logger.error('error message');
      
      assert.strictEqual(consoleLogs.length, 5);
    });
  });

  t.test('log methods', (t) => {
    const config: LoggerConfig = { logLevel: LogLevel.TRACE, redaction: false };

    t.test('fatal() should log and exit process', () => {
      const logger = createLogger('TestModule', config, ['baseTag']);
      logger.fatal('fatal message', ['fatalTag'], testContext);
      
      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, 'error');
      assert.strictEqual(processExitCalled, true);
      
      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.strictEqual(logOutput.level, 'FATAL');
      assert.strictEqual(logOutput.message, 'fatal message');
      assert.deepStrictEqual(logOutput.tags, ['baseTag', 'fatalTag']);
      assert.deepStrictEqual(logOutput.context, testContext);
    });

    t.test('error() should handle string messages', () => {
      const logger = createLogger('TestModule', config, ['baseTag']);
      logger.error('error message', ['errorTag'], testContext);
      
      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, 'error');
      assert.strictEqual(processExitCalled, false);
      
      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.strictEqual(logOutput.level, 'ERROR');
      assert.strictEqual(logOutput.message, 'error message');
    });

    t.test('error() should handle Error objects', () => {
      const testError = new Error('Test error message');
      testError.stack = 'Error: Test error message\n    at test';
      
      const logger = createLogger('TestModule', config, ['baseTag']);
      logger.error(testError, ['errorTag'], testContext);
      
      assert.strictEqual(consoleLogs.length, 1);
      const logOutput = parseLogOutput(consoleLogs[0]);
      
      assert.strictEqual(logOutput.message, 'Test error message');
      assert.ok(logOutput.context.error);
      assert.strictEqual(logOutput.context.error.message, 'Test error message');
    });

    t.test('warn() should use console.warn', () => {
      const logger = createLogger('TestModule', config, ['baseTag']);
      logger.warn('warning message', ['warnTag'], testContext);
      
      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, 'warn');
      
      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.strictEqual(logOutput.level, 'WARNING');
    });

    t.test('info() should use console.log', () => {
      const logger = createLogger('TestModule', config, ['baseTag']);
      logger.info('info message', ['infoTag'], testContext);
      
      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, 'log');
      
      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.strictEqual(logOutput.level, 'INFO');
    });

    t.test('debug() should use console.debug', () => {
      const logger = createLogger('TestModule', config, ['baseTag']);
      logger.debug('debug message', ['debugTag'], testContext);
      
      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, 'debug');
      
      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.strictEqual(logOutput.level, 'DEBUG');
    });

    t.test('trace() should use console.trace', () => {
      const logger = createLogger('TestModule', config, ['baseTag']);
      logger.trace('trace message', ['traceTag'], testContext);
      
      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, 'trace');
      
      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.strictEqual(logOutput.level, 'TRACE');
    });
  });

  t.test('tag merging', (t) => {
    t.test('should combine base tags with method tags', () => {
      const config: LoggerConfig = { logLevel: LogLevel.INFO, redaction: false };
      const logger = createLogger('TestModule', config, ['baseTag1', 'baseTag2']);
      logger.info('test message', ['methodTag1', 'methodTag2']);
      
      assert.strictEqual(consoleLogs.length, 1);
      const logOutput = parseLogOutput(consoleLogs[0]);
      assert.deepStrictEqual(logOutput.tags, ['baseTag1', 'baseTag2', 'methodTag1', 'methodTag2']);
    });
  });

  t.test('formatting error handling', (t) => {
    t.test('should catch formatting errors and log raw message', () => {
      // Create a problematic transformer that throws
      const badTransformer: LogObjectTransformer = {
        priority: 1,
        canTransform: () => true,
        transform: () => { throw new Error('Transformer error'); }
      };
      
      const config: LoggerConfig = { logLevel: LogLevel.INFO, redaction: true };
      const logger = new BaseLogger(
        'TestModule',
        config,
        mockConsole,
        [], // serializers
        [badTransformer], // redactors with problematic transformer
        []
      );
      
      logger.info('test message', [], testContext);
      
      // Should have logged the error to console.error
      assert.strictEqual(consoleLogs.length, 1);
      assert.strictEqual(consoleLogs[0].method, 'error');
      const errorMessage = consoleLogs[0].args[0] as string;
      assert.ok(errorMessage.includes('LOGGER FORMATTING ERROR'));
    });
  });
});
