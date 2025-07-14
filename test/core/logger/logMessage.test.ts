import { test } from 'node:test';
import * as assert from 'node:assert';
import { LogMessage } from '../../../src/core/logger/logMessage.js';
import { LogLevel, type LogContext } from '../../../src/core/logger/types.js';

test('LogMessage', (t) => {
  const testContext: LogContext = { requestId: '123', userId: 'user456' };
  
  t.test('constructor', (t) => {
    t.test('should create LogMessage with all properties', () => {
      const message = new LogMessage(
        'Test message',
        'TestNamespace',
        ['tag1', 'tag2'],
        LogLevel.INFO,
        testContext
      );

      assert.strictEqual(message.message, 'Test message');
      assert.strictEqual(message.namespace, 'TestNamespace');
      assert.deepStrictEqual(message.tags, ['tag1', 'tag2']);
      assert.strictEqual(message.level, 'INFO');
      assert.deepStrictEqual(message.context, testContext);
      assert.ok(message.timestamp);
      assert.ok(new Date(message.timestamp).getTime() > 0);
    });

    t.test('should use default values for optional parameters', () => {
      const message = new LogMessage('Test message', 'TestNamespace', undefined, undefined, testContext);

      assert.strictEqual(message.message, 'Test message');
      assert.strictEqual(message.namespace, 'TestNamespace');
      assert.deepStrictEqual(message.tags, []);
      assert.strictEqual(message.level, LogLevel[LogMessage.default]);
      assert.deepStrictEqual(message.context, testContext);
    });

    t.test('should generate timestamp automatically', () => {
      const before = new Date().toISOString();
      const message = new LogMessage('Test', 'Test', [], LogLevel.INFO, testContext);
      const after = new Date().toISOString();

      assert.ok(message.timestamp >= before);
      assert.ok(message.timestamp <= after);
    });
  });

  t.test('create() static method', (t) => {
    t.test('should create LogMessage with all parameters', () => {
      const message = LogMessage.create(
        'Static test message',
        'StaticNamespace',
        ['static1', 'static2'],
        LogLevel.ERROR,
        testContext
      );

      assert.strictEqual(message.message, 'Static test message');
      assert.strictEqual(message.namespace, 'StaticNamespace');
      assert.deepStrictEqual(message.tags, ['static1', 'static2']);
      assert.strictEqual(message.level, 'ERROR');
      assert.deepStrictEqual(message.context, testContext);
    });

    t.test('should use default values for optional parameters', () => {
      const message = LogMessage.create('Static test', 'StaticNamespace', undefined, undefined, testContext);

      assert.deepStrictEqual(message.tags, []);
      assert.strictEqual(message.level, LogLevel[LogMessage.default]);
    });
  });

  t.test('log level string conversion', (t) => {
    t.test('should convert all LogLevel enum values to strings', () => {
      const testCases = [
        { level: LogLevel.FATAL, expected: 'FATAL' },
        { level: LogLevel.ERROR, expected: 'ERROR' },
        { level: LogLevel.WARNING, expected: 'WARNING' },
        { level: LogLevel.INFO, expected: 'INFO' },
        { level: LogLevel.DEBUG, expected: 'DEBUG' },
        { level: LogLevel.TRACE, expected: 'TRACE' }
      ];

      testCases.forEach(({ level, expected }) => {
        const message = new LogMessage('test', 'test', [], level, testContext);
        assert.strictEqual(message.level, expected);
      });
    });
  });

  t.test('default log level', (t) => {
    t.test('should have DEBUG as default level', () => {
      assert.strictEqual(LogMessage.default, LogLevel.DEBUG);
    });
  });
});
