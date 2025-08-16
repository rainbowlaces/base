 
import { test } from 'node:test';
import * as assert from 'node:assert';
import { mock } from 'node:test';
import path from 'path';
import type * as fs from 'fs';

// Import the class to test
import { BaseStatic, type BaseStaticConfig } from '../../../src/modules/static/baseStatic.js';
import { type FileSystem } from '../../../src/utils/fileSystem.js';
import { type BaseLogger } from '../../../src/core/logger/baseLogger.js';
import { getModuleWithMocks, getMockFileSystem } from '../../testUtils/utils.js';

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

// Type for test instance with additional test properties
type TestBaseStatic = BaseStatic & { 
  testLogger: BaseLogger; 
  testConfig: BaseStaticConfig; 
};

// Create a testable BaseStatic instance using getModuleWithMocks
const CREATE_TEST_INSTANCE = (configOverrides: Record<string, unknown> = {}, mockFileSystem?: FileSystem): TestBaseStatic => {
  // Always ensure we have a mocked FileSystem - never let BaseStatic use the real one
  const fileSystemMock = mockFileSystem ?? getMockFileSystem();
  
  const { module, logger, config } = getModuleWithMocks<BaseStaticConfig, BaseStatic>(
    'BaseStatic', 
    () => new BaseStatic(fileSystemMock), // Pass the mock FileSystem to constructor
    { FileSystem: fileSystemMock }
  );
  
  // Apply config overrides using hydrate method
  if (Object.keys(configOverrides).length > 0) {
    config.hydrate(configOverrides);
  }
  
  // Bypass the DI decorator by setting the property directly on the object
  Object.defineProperty(module, 'baseFsRoot', {
    value: '/app',
    writable: true,
    enumerable: true,
    configurable: true
  });
  
  module.staticFsRoot = '';
  
  // Store references for test access
  (module as TestBaseStatic).testLogger = logger;
  (module as TestBaseStatic).testConfig = config;
  
  return module as TestBaseStatic;
};

test('BaseStatic setup() method', (t) => {

  t.test('should correctly resolve staticFsRoot with custom path from config', async () => {
    const instance = CREATE_TEST_INSTANCE({ staticFsRoot: '/assets' });
    
    await instance.setup();
    
    assert.strictEqual(instance.staticFsRoot, path.normalize('/app/assets'));
  });

  t.test('should use default /public path when config.staticFsRoot is not provided', async () => {
    const instance = CREATE_TEST_INSTANCE();
    
    await instance.setup();
    
    assert.strictEqual(instance.staticFsRoot, path.normalize('/app/public'));
  });

  t.test('should properly initialize with custom config values', async () => {
    const instance = CREATE_TEST_INSTANCE({ staticFsRoot: '/custom', maxAge: 7200 });
    
    await instance.setup();
    
    // Verify the actual behavior - correct path resolution and config usage
    assert.strictEqual(instance.staticFsRoot, path.normalize('/app/custom'));
    assert.strictEqual(instance.testConfig.maxAge, 7200);
  });
});

test('BaseStatic cleanPath() method', (t) => {
  let instance: TestBaseStatic;
  
  t.beforeEach(async () => {
    instance = CREATE_TEST_INSTANCE();
  });

  t.test('should handle a simple, clean path', () => {
     
    const result = (instance as any).cleanPath('foo/bar.jpg');
    assert.deepStrictEqual(result, ['foo', 'bar.jpg']);
  });

  t.test('should remove leading and trailing slashes', () => {
     
    const result = (instance as any).cleanPath('/foo/bar.jpg/');
    assert.deepStrictEqual(result, ['foo', 'bar.jpg']);
  });

  t.test('should filter out empty segments caused by multiple slashes', () => {
     
    const result = (instance as any).cleanPath('foo//bar.jpg');
    assert.deepStrictEqual(result, ['foo', 'bar.jpg']);
  });

  t.test('should return empty array for empty or whitespace-only path', () => {
     
    const cleanPath = (instance as any).cleanPath.bind(instance);
    assert.deepStrictEqual(cleanPath(''), []);
    assert.deepStrictEqual(cleanPath('   '), []);
    assert.deepStrictEqual(cleanPath('\t\n'), []);
  });

  t.test('should handle complex path with multiple issues', () => {
     
    const result = (instance as any).cleanPath('//foo///bar//baz.txt//');
    assert.deepStrictEqual(result, ['foo', 'bar', 'baz.txt']);
  });
});

test('BaseStatic handleStatic() method', (t) => {
  let instance: TestBaseStatic;
  let mockCtx: ReturnType<typeof CREATE_MOCK_CONTEXT>;
  let mockFileSystem: FileSystem;

  t.beforeEach(async () => {
    mockFileSystem = getMockFileSystem();
    instance = CREATE_TEST_INSTANCE({}, mockFileSystem);
    await instance.setup();

    mockCtx = CREATE_MOCK_CONTEXT();
    
    // Mock sendFile method
     
    (instance as any).sendFile = mock.fn();
  });

  t.test('should return 404 Not Found if path is missing', async () => {
    const args = { topic: 'test', context: mockCtx, path: undefined };
    
     
    await instance.handleStatic(args as any);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [404]);
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.send.mock.calls[0].arguments, ['Not found']);
  });

  t.test('should return 404 Not Found if path becomes empty after cleaning', async () => {
    const args = { topic: 'test', context: mockCtx, path: '///' };
    
     
    await instance.handleStatic(args as any);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [404]);
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.send.mock.calls[0].arguments, ['Not found']);
  });

  t.test('should return 404 Not Found for path traversal attempt (collapsed)', async () => {
    const args = { topic: 'test', context: mockCtx, path: '../../etc/passwd' };
    
     
    await instance.handleStatic(args as any);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
  assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [404]);
  assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
  assert.deepStrictEqual(mockCtx.res.send.mock.calls[0].arguments, ['Not found']);
  });

  t.test('should return 404 Not Found when fileSystem throws ENOENT error', async () => {
    const args = { topic: 'test', context: mockCtx, path: 'nonexistent.txt' };
    const error = new Error('NOT FOUND') as Error & { code?: string };
    error.code = 'ENOENT';
    
     
  (mockFileSystem.openStatRead as any).mock.mockImplementation(() => {
      throw error;
    });
    
     
    await instance.handleStatic(args as any);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [404]);
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.send.mock.calls[0].arguments, ['Not found']);
  });

  t.test('should return 404 Not Found when fileSystem throws error with message "NOT FOUND"', async () => {
    const args = { topic: 'test', context: mockCtx, path: 'nonexistent.txt' };
    const error = new Error('NOT FOUND');
    
     
  (mockFileSystem.openStatRead as any).mock.mockImplementation(() => {
      throw error;
    });
    
     
    await instance.handleStatic(args as any);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [404]);
  });

  t.test('should collapse unexpected errors to 404', async () => {
    const args = { topic: 'test', context: mockCtx, path: 'SOME_FILE_I_WILL_SEE' };
    const originalError = new Error('Unexpected error');
    
     
  (mockFileSystem.openStatRead as any).mock.mockImplementation(() => {
      throw originalError;
    });
    
  await instance.handleStatic(args as any);
  assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
  assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [404]);
  });

  t.test('should successfully call sendFile when file is loaded correctly', async () => {
    const args = { topic: 'test', context: mockCtx, path: 'test.txt' };
    const mockData = Buffer.from('test content');
    const mockStats = {
      size: mockData.length,
      mtime: new Date(),
    } as fs.Stats;
    
    // Mock successful file operations
     
  (mockFileSystem.openStatRead as any).mock.mockImplementation(() => Promise.resolve({ stats: mockStats, data: mockData }));
    
     
    await instance.handleStatic(args as any);
    
    // Should not return any error status
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 0);
    
    // Should call sendFile with correct arguments
     
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
  let instance: TestBaseStatic;
  let mockCtx: ReturnType<typeof CREATE_MOCK_CONTEXT>;
  const testFilePath = '/app/public/test.txt';
  const testData = Buffer.from('test content');
  const testStats = {
    size: testData.length,
    mtime: new Date('2023-01-01T12:00:00Z'),
  } as fs.Stats;

  t.beforeEach(async () => {
    instance = CREATE_TEST_INSTANCE({ maxAge: 7200 });
    mockCtx = CREATE_MOCK_CONTEXT();
  });

  t.test('should return 304 Not Modified if client ETag matches file ETag', async () => {
    // Calculate expected ETag
  const expectedEtag = `W/"${testData.length}-${testStats.mtime.getTime()}"`;
    
     
  (mockCtx.req.header as any).mock.mockImplementation((h: string) => h === 'if-none-match' ? expectedEtag : undefined);
    
     
    await (instance as any).sendFile(mockCtx, testFilePath, testData, testStats);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [304]);
  assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
  assert.deepStrictEqual(mockCtx.res.send.mock.calls[0].arguments, ['']);
  });

  t.test('should return 304 Not Modified if If-Modified-Since is newer than file mtime', async () => {
    const futureDate = new Date('2023-01-02T12:00:00Z');
    
     
    (mockCtx.req.header as any).mock.mockImplementation((headerName: string) => {
      if (headerName === 'if-none-match') return undefined;
      if (headerName === 'if-modified-since') return futureDate.toUTCString();
      return undefined;
    });
    
     
    await (instance as any).sendFile(mockCtx, testFilePath, testData, testStats);
    
    assert.strictEqual(mockCtx.res.statusCode.mock.callCount(), 1);
    assert.deepStrictEqual(mockCtx.res.statusCode.mock.calls[0].arguments, [304]);
  assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
  assert.deepStrictEqual(mockCtx.res.send.mock.calls[0].arguments, ['']);
  });

  t.test('should send file with correct headers if no caching headers match', async () => {
     
    (mockCtx.req.header as any).mock.mockImplementation(() => undefined);
    
     
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
     
    (mockCtx.req.header as any).mock.mockImplementation(() => undefined);
    
     
    await (instanceWithDefaults as any).sendFile(mockCtx, testFilePath, testData, testStats);
    
    const cacheControlCall = mockCtx.res.header.mock.calls.find((call) => call.arguments[0] === 'Cache-Control');
    assert.ok(cacheControlCall, 'Cache-Control header should be set');
    assert.strictEqual(cacheControlCall.arguments[1], 'public, max-age=3600'); // Default value
  });

  t.test('should handle string data correctly', async () => {
    const stringData = 'test content as string';
    (mockCtx.req.header as any).mock.mockImplementation(() => undefined);
    
    await (instance as any).sendFile(mockCtx, testFilePath, stringData, testStats);
    
    // Should send string data
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    const sendCall = mockCtx.res.send.mock.calls[0];
    assert.strictEqual(sendCall.arguments[0], stringData);
  });

  t.test('should use application/octet-stream for unknown file types', async () => {
    const unknownFilePath = '/app/public/test.unknown';
    (mockCtx.req.header as any).mock.mockImplementation(() => undefined);
    
    await (instance as any).sendFile(mockCtx, unknownFilePath, testData, testStats);
    
    assert.strictEqual(mockCtx.res.send.mock.callCount(), 1);
    const sendCall = mockCtx.res.send.mock.calls[0];
    assert.strictEqual(sendCall.arguments[1], 'application/octet-stream');
  });
});
