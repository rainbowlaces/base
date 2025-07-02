import { test } from 'node:test';
import * as assert from 'node:assert';
import { mock } from 'node:test';
import path from 'path';
import crypto from 'crypto';
import type * as fs from 'fs';

// Import the class to test
import { BaseStatic } from '../../../src/modules/static/baseStatic';
import { type FileSystem } from '../../../src/utils/fileSystem';

// Mock all external dependencies
const MOCK_LOGGER = {
  debug: mock.fn(),
  info: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
};

const MOCK_CONFIG = {
  staticFsRoot: undefined as string | undefined,
  maxAge: undefined as number | undefined,
};

// Create a mock FileSystem implementation
const CREATE_MOCK_FILE_SYSTEM = (): FileSystem => ({
  readFile: mock.fn(),
  readdir: mock.fn(),
  stat: mock.fn(),
});

// Create mock HTTP context
const CREATE_MOCK_CONTEXT = () => {
  const mockReq = {
    header: mock.fn(),
  };
  
  const mockRes = {
    statusCode: mock.fn(),
    send: mock.fn(),
    header: mock.fn(),
  };
  
  return {
    id: 'test-context-id',
    req: mockReq,
    res: mockRes,
  };
};

// Create a testable BaseStatic instance by mocking its dependencies
const CREATE_TEST_INSTANCE = (configOverrides: Record<string, unknown> = {}, mockFileSystem?: FileSystem) => {
  // Create a new instance properly
  const instance = new BaseStatic();
  
  // Mock the inherited properties from BaseModule
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (instance as any).logger = MOCK_LOGGER;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (instance as any).config = { ...MOCK_CONFIG, ...configOverrides };
  
  // Bypass the DI decorator by setting the property directly on the object
  Object.defineProperty(instance, 'baseFsRoot', {
    value: '/app',
    writable: true,
    enumerable: true,
    configurable: true
  });
  
  instance.staticFsRoot = '';
  
  // Inject the mock FileSystem if provided
  if (mockFileSystem) {
    instance.fileSystem = mockFileSystem;
  }
  
  return instance;
};

test('BaseStatic setup() method', (t) => {
  t.beforeEach(() => {
    // Reset all mocks before each test
    MOCK_LOGGER.debug.mock.resetCalls();
    MOCK_LOGGER.info.mock.resetCalls();
    MOCK_CONFIG.staticFsRoot = undefined;
    MOCK_CONFIG.maxAge = undefined;
  });

  t.test('should correctly resolve staticFsRoot with custom path from config', async () => {
    const instance = CREATE_TEST_INSTANCE({ staticFsRoot: '/assets' });
    
    await instance.setup();
    
    assert.strictEqual(instance.staticFsRoot, path.normalize('/app/assets'));
    assert.ok(MOCK_LOGGER.info.mock.calls.some((call) => 
      (call.arguments[0] as string).includes('Static file root: /app/assets')
    ));
  });

  t.test('should use default /public path when config.staticFsRoot is not provided', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    await instance.setup();
    
    assert.strictEqual(instance.staticFsRoot, path.normalize('/app/public'));
    assert.ok(MOCK_LOGGER.info.mock.calls.some((call) => 
      (call.arguments[0] as string).includes('Static file root: /app/public')
    ));
  });

  t.test('should log debug messages during setup', async () => {
    const instance = CREATE_TEST_INSTANCE({ staticFsRoot: '/custom', maxAge: 7200 });
    
    await instance.setup();
    
    // Check that debug messages were logged
    assert.ok(MOCK_LOGGER.debug.mock.callCount() >= 4);
    assert.ok(MOCK_LOGGER.debug.mock.calls.some((call) => 
      (call.arguments[0] as string).includes('BaseStatic setup starting')
    ));
    assert.ok(MOCK_LOGGER.debug.mock.calls.some((call) => 
      (call.arguments[0] as string).includes('BaseStatic setup complete')
    ));
  });
});

test('BaseStatic cleanPath() method', (t) => {
  let instance: BaseStatic;
  
  t.beforeEach(() => {
    instance = CREATE_TEST_INSTANCE();
  });

  t.test('should handle a simple, clean path', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (instance as any).cleanPath('foo/bar.jpg');
    assert.deepStrictEqual(result, ['foo', 'bar.jpg']);
  });

  t.test('should remove leading and trailing slashes', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (instance as any).cleanPath('/foo/bar.jpg/');
    assert.deepStrictEqual(result, ['foo', 'bar.jpg']);
  });

  t.test('should filter out empty segments caused by multiple slashes', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (instance as any).cleanPath('foo//bar.jpg');
    assert.deepStrictEqual(result, ['foo', 'bar.jpg']);
  });

  t.test('should return empty array for empty or whitespace-only path', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanPath = (instance as any).cleanPath.bind(instance);
    assert.deepStrictEqual(cleanPath(''), []);
    assert.deepStrictEqual(cleanPath('   '), []);
    assert.deepStrictEqual(cleanPath('\t\n'), []);
  });

  t.test('should handle complex path with multiple issues', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (instance as any).cleanPath('//foo///bar//baz.txt//');
    assert.deepStrictEqual(result, ['foo', 'bar', 'baz.txt']);
  });
});

test('BaseStatic handleStatic() method', (t) => {
  let instance: BaseStatic;
  let mockCtx: ReturnType<typeof CREATE_MOCK_CONTEXT>;
  let mockFileSystem: FileSystem;

  t.beforeEach(() => {
    mockFileSystem = CREATE_MOCK_FILE_SYSTEM();
    instance = CREATE_TEST_INSTANCE({}, mockFileSystem);
    instance.staticFsRoot = '/app/public';
    mockCtx = CREATE_MOCK_CONTEXT();
    
    // Reset mocks
    MOCK_LOGGER.debug.mock.resetCalls();
    MOCK_LOGGER.warn.mock.resetCalls();
    MOCK_LOGGER.info.mock.resetCalls();
    
    // Mock sendFile method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (instance as any).sendFile = mock.fn();
  });

  t.test('should return 400 Bad Request if path is missing', async () => {
    const args = { topic: 'test', context: mockCtx, path: undefined };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await instance.handleStatic(args as any);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [400]);
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.send.mock.calls[0].arguments, ['Bad request']);
  });

  t.test('should return 400 Bad Request if path becomes empty after cleaning', async () => {
    const args = { topic: 'test', context: mockCtx, path: '///' };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await instance.handleStatic(args as any);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [400]);
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.send.mock.calls[0].arguments, ['Bad request']);
  });

  t.test('should return 403 Forbidden for path traversal attempt', async () => {
    const args = { topic: 'test', context: mockCtx, path: '../../etc/passwd' };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await instance.handleStatic(args as any);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [403]);
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.send.mock.calls[0].arguments, ['Forbidden']);
    
    // Should log warning about security violation
    assert.ok(MOCK_LOGGER.warn.mock.calls.some((call) => 
      (call.arguments[0] as string).includes('is outside of root')
    ));
  });

  t.test('should return 404 Not Found when fileSystem throws ENOENT error', async () => {
    const args = { topic: 'test', context: mockCtx, path: 'nonexistent.txt' };
    const error = new Error('NOT FOUND') as Error & { code?: string };
    error.code = 'ENOENT';
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockFileSystem.readFile as any).mock.mockImplementation(() => {
      throw error;
    });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await instance.handleStatic(args as any);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [404]);
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.send.mock.calls[0].arguments, ['Not found']);
  });

  t.test('should return 404 Not Found when fileSystem throws error with message "NOT FOUND"', async () => {
    const args = { topic: 'test', context: mockCtx, path: 'nonexistent.txt' };
    const error = new Error('NOT FOUND');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockFileSystem.readFile as any).mock.mockImplementation(() => {
      throw error;
    });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await instance.handleStatic(args as any);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [404]);
  });

  t.test('should re-throw BaseError for unexpected errors from fileSystem', async () => {
    const args = { topic: 'test', context: mockCtx, path: 'test.txt' };
    const originalError = new Error('Unexpected error');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockFileSystem.readFile as any).mock.mockImplementation(() => {
      throw originalError;
    });
    
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => instance.handleStatic(args as any),
      (err: Error) => {
        assert.strictEqual(err.constructor.name, 'BaseError');
        return true;
      }
    );
  });

  t.test('should successfully call sendFile when file is loaded correctly', async () => {
    const args = { topic: 'test', context: mockCtx, path: 'test.txt' };
    const mockData = Buffer.from('test content');
    const mockStats = {
      size: mockData.length,
      mtime: new Date(),
    } as fs.Stats;
    
    // Mock successful file operations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockFileSystem.readFile as any).mock.mockImplementation(() => Promise.resolve(mockData));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockFileSystem.stat as any).mock.mockImplementation(() => Promise.resolve(mockStats));
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await instance.handleStatic(args as any);
    
    // Should not return any error status
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 0);
    
    // Should call sendFile with correct arguments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendFile = (instance as any).sendFile;
    assert.strictEqual(sendFile.mock.callCount(), 1);
    const sendFileCall = sendFile.mock.calls[0];
    assert.strictEqual(sendFileCall.arguments[0], mockCtx);
    assert.ok((sendFileCall.arguments[1] as string).includes('test.txt'));
    assert.strictEqual(sendFileCall.arguments[2], mockData);
    assert.strictEqual(sendFileCall.arguments[3], mockStats);
  });
});

test('BaseStatic sendFile() method', (t) => {
  let instance: BaseStatic;
  let mockCtx: ReturnType<typeof CREATE_MOCK_CONTEXT>;
  const testFilePath = '/app/public/test.txt';
  const testData = Buffer.from('test content');
  const testStats = {
    size: testData.length,
    mtime: new Date('2023-01-01T12:00:00Z'),
  } as fs.Stats;

  t.beforeEach(() => {
    instance = CREATE_TEST_INSTANCE({ maxAge: 7200 });
    mockCtx = CREATE_MOCK_CONTEXT();
    
    // Reset logger mocks
    MOCK_LOGGER.debug.mock.resetCalls();
  });

  t.test('should return 304 Not Modified if client ETag matches file ETag', async () => {
    // Calculate expected ETag
    const hash = crypto.createHash('sha1');
    hash.update(new Uint8Array(testData));
    const expectedEtag = hash.digest('hex');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockCtx.req.header as any).mock.mockImplementation(() => expectedEtag);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (instance as any).sendFile(mockCtx, testFilePath, testData, testStats);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [304]);
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.send.mock.calls[0].arguments, ['Not Modified']);
  });

  t.test('should return 304 Not Modified if If-Modified-Since is newer than file mtime', async () => {
    const futureDate = new Date('2023-01-02T12:00:00Z');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockCtx.req.header as any).mock.mockImplementation((headerName: string) => {
      if (headerName === 'if-none-match') return undefined;
      if (headerName === 'if-modified-since') return futureDate.toUTCString();
      return undefined;
    });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (instance as any).sendFile(mockCtx, testFilePath, testData, testStats);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [304]);
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.send.mock.calls[0].arguments, ['Not Modified']);
  });

  t.test('should send file with correct headers if no caching headers match', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockCtx.req.header as any).mock.mockImplementation(() => undefined);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (instance as any).sendFile(mockCtx, testFilePath, testData, testStats);
    
    // Should not return 304
    assert.ok(!mockCtx.res.statusCode.mock.calls.some((call) => call.arguments[0] === 304));
    
    // Should set required headers
    const headerCalls = mockCtx.res.header.mock.calls;
    
    // Check ETag header
    const etagCall = headerCalls.find((call) => call.arguments[0] === 'ETag');
    assert.ok(etagCall, 'ETag header should be set');
    
    // Check Last-Modified header
    const lastModifiedCall = headerCalls.find((call) => call.arguments[0] === 'Last-Modified');
    assert.ok(lastModifiedCall, 'Last-Modified header should be set');
    assert.strictEqual(lastModifiedCall.arguments[1], testStats.mtime.toUTCString());
    
    // Check Cache-Control header
    const cacheControlCall = headerCalls.find((call) => call.arguments[0] === 'Cache-Control');
    assert.ok(cacheControlCall, 'Cache-Control header should be set');
    assert.strictEqual(cacheControlCall.arguments[1], 'public, max-age=7200');
    
    // Should send file data with correct MIME type
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    const sendCall = mockCtx.res.send.mock.calls[0];
    assert.strictEqual(sendCall.arguments[0], testData);
    assert.strictEqual(sendCall.arguments[1], 'text/plain'); // mime-types will resolve .txt to text/plain
  });

  t.test('should use default max-age when not configured', async () => {
    const instanceWithDefaults = CREATE_TEST_INSTANCE(); // No maxAge specified
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockCtx.req.header as any).mock.mockImplementation(() => undefined);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (instanceWithDefaults as any).sendFile(mockCtx, testFilePath, testData, testStats);
    
    const cacheControlCall = mockCtx.res.header.mock.calls.find((call) => call.arguments[0] === 'Cache-Control');
    assert.ok(cacheControlCall, 'Cache-Control header should be set');
    assert.strictEqual(cacheControlCall.arguments[1], 'public, max-age=3600'); // Default value
  });

  t.test('should handle string data correctly', async () => {
    const stringData = 'test content as string';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockCtx.req.header as any).mock.mockImplementation(() => undefined);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (instance as any).sendFile(mockCtx, testFilePath, stringData, testStats);
    
    // Should send string data
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    const sendCall = mockCtx.res.send.mock.calls[0];
    assert.strictEqual(sendCall.arguments[0], stringData);
  });

  t.test('should use application/octet-stream for unknown file types', async () => {
    const unknownFilePath = '/app/public/test.unknown';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockCtx.req.header as any).mock.mockImplementation(() => undefined);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (instance as any).sendFile(mockCtx, unknownFilePath, testData, testStats);
    
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    const sendCall = mockCtx.res.send.mock.calls[0];
    assert.strictEqual(sendCall.arguments[1], 'application/octet-stream');
  });
});
