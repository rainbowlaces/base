import { test } from 'node:test';
import * as assert from 'node:assert';
import { mock } from 'node:test';
import type * as fs from 'fs';
import { BaseStatic, type BaseStaticConfig } from '../../../src/modules/static/baseStatic.js';
import { type FileSystem } from '../../../src/utils/fileSystem.js';
import { getModuleWithMocks, getMockFileSystem } from '../../testUtils/utils.js';

// Helper to build HTTP context with configurable Accept-Encoding header
const BUILD_CTX = (acceptEncoding?: string, method: string = 'get') => {
  const req = { header: mock.fn((h: string) => {
    if (h.toLowerCase() === 'accept-encoding') return acceptEncoding;
    return undefined;
  }), method } as any;
  const resHeaders: Record<string,string> = {};
  let status = 200;
  const res = {
    statusCode: mock.fn((code: number) => { status = code; }),
    get currentStatus() { return status; },
    send: mock.fn(),
    header: mock.fn((k: string, v: string) => { resHeaders[k] = v; }),
    headers: resHeaders
  } as any;
  return { id: 'ctx', req, res };
};

type TestBaseStatic = BaseStatic & { testConfig: BaseStaticConfig };

const CREATE_INSTANCE = (configOverrides: Partial<BaseStaticConfig> = {}, fsMock?: FileSystem): TestBaseStatic => {
  const fileSystem = fsMock ?? getMockFileSystem();
  const { module, config } = getModuleWithMocks<BaseStaticConfig, BaseStatic>('BaseStatic', () => new BaseStatic(fileSystem), { FileSystem: fileSystem });
  if (Object.keys(configOverrides).length) config.hydrate(configOverrides);
  Object.defineProperty(module, 'baseFsRoot', { value: '/app', writable: true });
  (module as any).staticFsRoot = '';
  (module as any).testConfig = config;
  return module as TestBaseStatic;
};

// Utility to make stats
const MAKE_STATS = (size: number, mtime = new Date(1700000000000)): fs.Stats => ({
  size,
  mtime,
  isDirectory: () => false,
  isFile: () => true
}) as unknown as fs.Stats;

test('BaseStatic compression & negotiation integration', (t) => {
  t.test('chooses brotli when higher q than gzip', async () => {
  const fsMock = getMockFileSystem();
  const data = Buffer.from('x'.repeat(3000));
  (fsMock.openStatRead as any).mock.mockImplementation(async () => ({ stats: MAKE_STATS(data.length), data }));
  (fsMock.stat as any).mock.mockImplementation(async () => MAKE_STATS(data.length));
    (fsMock.realpath as any).mock.mockImplementation(async (p: string) => p);
  const instance = CREATE_INSTANCE({ compressionThreshold: 10 }, fsMock);
    await instance.setup();
  const ctx = BUILD_CTX('br;q=0.9, gzip;q=0.5');
    await instance.handleStatic({ topic: 't', context: ctx as any, path: 'file.txt' } as any);
  assert.strictEqual(ctx.res.headers['Content-Encoding'], 'br');
  assert.ok(ctx.res.headers['Vary']);
  });

  t.test('chooses gzip when gzip higher q than brotli', async () => {
    const fsMock = getMockFileSystem();
    const data = Buffer.from('y'.repeat(4000));
  (fsMock.openStatRead as any).mock.mockImplementation(async () => ({ stats: MAKE_STATS(data.length), data }));
  (fsMock.stat as any).mock.mockImplementation(async () => MAKE_STATS(data.length));
    (fsMock.realpath as any).mock.mockImplementation(async (p: string) => p);
  const instance = CREATE_INSTANCE({ compressionThreshold: 10 }, fsMock);
    await instance.setup();
  const ctx = BUILD_CTX('gzip;q=0.9, br;q=0.5');
    await instance.handleStatic({ topic: 't', context: ctx as any, path: 'file.txt' } as any);
  assert.strictEqual(ctx.res.headers['Content-Encoding'], 'gzip');
  });

  t.test('wildcard * selects first non-forbidden algorithm', async () => {
    const fsMock = getMockFileSystem();
    const data = Buffer.from('z'.repeat(4096));
  (fsMock.openStatRead as any).mock.mockImplementation(async () => ({ stats: MAKE_STATS(data.length), data }));
  (fsMock.stat as any).mock.mockImplementation(async () => MAKE_STATS(data.length));
    (fsMock.realpath as any).mock.mockImplementation(async (p: string) => p);
  const instance = CREATE_INSTANCE({ compressionThreshold: 10 }, fsMock);
    await instance.setup();
  const ctx = BUILD_CTX('br;q=0, *');
    await instance.handleStatic({ topic: 't', context: ctx as any, path: 'file.txt' } as any);
  assert.strictEqual(ctx.res.headers['Content-Encoding'], 'gzip');
  });

  t.test('returns 406 when identity;q=0 and file not compressible', async () => {
    const fsMock = getMockFileSystem();
    const data = Buffer.from('b'.repeat(2000)); // exceed threshold but still application/zip (never compress)
  (fsMock.openStatRead as any).mock.mockImplementation(async () => ({ stats: MAKE_STATS(data.length), data }));
  (fsMock.stat as any).mock.mockImplementation(async () => MAKE_STATS(data.length));
    (fsMock.realpath as any).mock.mockImplementation(async (p: string) => p);
  const instance = CREATE_INSTANCE({ compressionThreshold: 10 }, fsMock);
    await instance.setup();
  const ctx = BUILD_CTX('identity;q=0');
    await instance.handleStatic({ topic: 't', context: ctx as any, path: 'archive.zip' } as any);
  assert.strictEqual(ctx.res.currentStatus, 406);
  });

  t.test('serves precompressed brotli file when present', async () => {
    const fsMock = getMockFileSystem();
    const raw = Buffer.from('a'.repeat(5000));
    const brotliBuf = Buffer.from('brotli');
  (fsMock.openStatRead as any).mock.mockImplementation(async () => ({ stats: MAKE_STATS(raw.length), data: raw }));
  (fsMock.stat as any).mock.mockImplementation(async () => MAKE_STATS(raw.length));
  (fsMock.exists as any).mock.mockImplementation(async (p: string) => p.endsWith('.br'));
  (fsMock.readFile as any).mock.mockImplementation(async (p: string) => p.endsWith('.br') ? brotliBuf : raw);
  (fsMock.realpath as any).mock.mockImplementation(async (p: string) => p);
  const instance = CREATE_INSTANCE({ compressionThreshold: 10 }, fsMock);
    await instance.setup();
    const ctx = BUILD_CTX('br');
  await instance.handleStatic({ topic: 't', context: ctx as any, path: 'styles.css' } as any);
  assert.strictEqual(ctx.res.headers['Content-Encoding'], 'br');
  // Ensure precompressed file specifically was read
  assert.ok((fsMock.readFile as any).mock.calls.some((c: any) => c.arguments[0].endsWith('.br')));
  });

  t.test('compression cache hit on second request', async () => {
    const fsMock = getMockFileSystem();
    const raw = Buffer.from('b'.repeat(8000));
  const stats = MAKE_STATS(raw.length);
  (fsMock.openStatRead as any).mock.mockImplementation(async () => ({ stats, data: raw }));
  (fsMock.stat as any).mock.mockImplementation(async () => stats);
    (fsMock.realpath as any).mock.mockImplementation(async (p: string) => p);
  (fsMock.exists as any).mock.mockImplementation(async () => false); // ensure dynamic compression
  const instance = CREATE_INSTANCE({ compressionThreshold: 10 }, fsMock);
    await instance.setup();
  const ctx1 = BUILD_CTX('gzip');
  await instance.handleStatic({ topic: 't', context: ctx1 as any, path: 'script.js' } as any);
  const cacheSizeAfterFirst = (instance as any).compressionCache.size;
  assert.ok(cacheSizeAfterFirst >= 1, 'compression cache should have entry after first request');
  const ctx2 = BUILD_CTX('gzip');
  await instance.handleStatic({ topic: 't', context: ctx2 as any, path: 'script.js' } as any);
  const cacheSizeAfterSecond = (instance as any).compressionCache.size;
  assert.ok(cacheSizeAfterSecond <= cacheSizeAfterFirst, 'cache size should not increase on cache hit');
  });

  t.test('compression cache eviction when over byte cap', async () => {
    const fsMock = getMockFileSystem();
    const makeFile = (char: string) => Buffer.from(char.repeat(4096));
  const statsA = MAKE_STATS(4096); const statsB = MAKE_STATS(4096); const statsC = MAKE_STATS(4096);
    (fsMock.openStatRead as any).mock.mockImplementation(async (p: string) => {
      if (p.endsWith('a.js')) return { stats: statsA, data: makeFile('a') };
      if (p.endsWith('b.js')) return { stats: statsB, data: makeFile('b') };
      return { stats: statsC, data: makeFile('c') };
    });
    (fsMock.stat as any).mock.mockImplementation(async (p: string) => {
      if (p.endsWith('a.js')) return statsA; if (p.endsWith('b.js')) return statsB; return statsC;
    });
    (fsMock.realpath as any).mock.mockImplementation(async (p: string) => p);
    // Small cache: allow roughly only two compressed entries
    const instance = CREATE_INSTANCE({ compressionThreshold: 10, compressionCacheMaxBytes: 6 * 1024 }, fsMock);
    await instance.setup();
  await instance.handleStatic({ topic: 't', context: BUILD_CTX('gzip') as any, path: 'a.js' } as any);
  await instance.handleStatic({ topic: 't', context: BUILD_CTX('gzip') as any, path: 'b.js' } as any);
  const sizeAfterTwo = (instance as any).compressionCache.size;
  await instance.handleStatic({ topic: 't', context: BUILD_CTX('gzip') as any, path: 'c.js' } as any); // triggers eviction
  const sizeAfterThree = (instance as any).compressionCache.size;
  assert.ok(sizeAfterThree <= sizeAfterTwo, 'cache size should not grow unbounded');
  // Ensure older key likely evicted: request a.js again creates (or replaces) entry -> size stays <= cap
  await instance.handleStatic({ topic: 't', context: BUILD_CTX('gzip') as any, path: 'a.js' } as any);
  const finalSize = (instance as any).compressionCache.size;
  assert.ok(finalSize <= sizeAfterTwo, 'final cache size within cap and eviction occurred');
  });
});

test('BaseStatic security integration', (t) => {
  t.test('blocks URL-encoded traversal', async () => {
  const instance = CREATE_INSTANCE(); await instance.setup();
  const ctx = BUILD_CTX();
    await instance.handleStatic({ topic: 't', context: ctx as any, path: '..%2F..%2Fetc/passwd' } as any);
  assert.strictEqual(ctx.res.currentStatus, 404);
  });

  t.test('blocks symlink escape via realpath', async () => {
    const fsMock = getMockFileSystem();
    const data = Buffer.from('hello');
  (fsMock.openStatRead as any).mock.mockImplementation(async () => ({ stats: MAKE_STATS(data.length), data }));
  (fsMock.stat as any).mock.mockImplementation(async () => MAKE_STATS(data.length));
    (fsMock.realpath as any).mock.mockImplementation(async () => '/etc/passwd');
  const instance = CREATE_INSTANCE({}, fsMock); await instance.setup();
  const ctx = BUILD_CTX();
    await instance.handleStatic({ topic: 't', context: ctx as any, path: 'file.txt' } as any);
  assert.strictEqual(ctx.res.currentStatus, 404);
  });

  t.test('allows dotfile when on allowlist', async () => {
    const fsMock = getMockFileSystem();
    const data = Buffer.from('ok');
  (fsMock.openStatRead as any).mock.mockImplementation(async () => ({ stats: MAKE_STATS(data.length), data }));
  (fsMock.stat as any).mock.mockImplementation(async () => MAKE_STATS(data.length));
    (fsMock.realpath as any).mock.mockImplementation(async (p: string) => p);
  const instance = CREATE_INSTANCE({ dotfileAllowlist: ['.well-known'] }, fsMock); await instance.setup();
  const ctx = BUILD_CTX();
    await instance.handleStatic({ topic: 't', context: ctx as any, path: '.well-known/assetlinks.json' } as any);
  assert.strictEqual(ctx.res.currentStatus ?? 200, 200);
  assert.strictEqual(ctx.res.send.mock.callCount(), 1);
  });

  t.test('rejects null byte in path', async () => {
  const instance = CREATE_INSTANCE(); await instance.setup();
  const ctx = BUILD_CTX();
    await instance.handleStatic({ topic: 't', context: ctx as any, path: 'foo/%00/bar.txt' } as any);
  assert.strictEqual(ctx.res.currentStatus, 404);
  });

  t.test('rejects oversize file', async () => {
    const fsMock = getMockFileSystem();
    const bigSize = 10 * 1024 * 1024; // 10MB
  (fsMock.openStatRead as any).mock.mockImplementation(async () => ({ stats: MAKE_STATS(bigSize), data: Buffer.alloc(10) }));
  (fsMock.stat as any).mock.mockImplementation(async () => MAKE_STATS(bigSize));
    (fsMock.realpath as any).mock.mockImplementation(async (p: string) => p);
  const instance = CREATE_INSTANCE({ maxFileSizeBytes: 1024 }, fsMock); await instance.setup();
  const ctx = BUILD_CTX();
    await instance.handleStatic({ topic: 't', context: ctx as any, path: 'big.bin' } as any);
  assert.strictEqual(ctx.res.currentStatus, 404);
  });

  t.test('rejects directory request', async () => {
    const fsMock = getMockFileSystem();
  const statsDir = { ...MAKE_STATS(0), isDirectory: () => true, isFile: () => false } as fs.Stats;
    (fsMock.openStatRead as any).mock.mockImplementation(async () => ({ stats: statsDir, data: Buffer.alloc(0) }));
    (fsMock.stat as any).mock.mockImplementation(async () => statsDir);
    (fsMock.realpath as any).mock.mockImplementation(async (p: string) => p);
  const instance = CREATE_INSTANCE({}, fsMock); await instance.setup();
  const ctx = BUILD_CTX();
    await instance.handleStatic({ topic: 't', context: ctx as any, path: 'adir' } as any);
  assert.strictEqual(ctx.res.currentStatus, 404);
  });
});
