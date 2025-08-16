import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import type * as http from 'http';
import { BaseDi } from '../../../src/core/di/baseDi.js';
import { BasePubSub } from '../../../src/core/pubsub/basePubSub.js';
import { BaseLogger } from '../../../src/core/logger/baseLogger.js';
import { BaseRouter } from '../../../src/core/requestHandler/baseRouter.js';
import { BaseRequestHandler } from '../../../src/core/requestHandler/baseRequestHandler.js';
import { BaseHttpContext } from '../../../src/core/requestHandler/httpContext.js';
import { request } from '../../../src/core/requestHandler/decorators/request.js';
import { type BaseRequestHandlerConfig } from '../../../src/core/requestHandler/types.js';
import { BaseModule } from '../../../src/core/module/baseModule.js';
import { registerDi } from '../../../src/core/di/decorators/registerDi.js';

// Helper delay (naming to satisfy lint rules)
const WAIT = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

describe('Request Timeout Control', () => {
  beforeEach(async () => {
    BaseDi.reset();
  BaseDi.register(BasePubSub, { singleton: true });
  BaseDi.register(BaseLogger, { key: 'BaseLogger', singleton: true });
  BaseDi.register(BaseRouter, { singleton: true });
  BaseDi.register(BaseRequestHandler, { singleton: true });
  // Minimal router config scalar registration
  BaseDi.register({ routes: {}, defaultRoute: '/' }, { key: 'Config.BaseRouter' });
  });

  afterEach(async () => {
    await BaseDi.teardown();
  });

  function mockReq(path: string): http.IncomingMessage {
    const headers = { host: 'localhost' } as Record<string, string>;
    const req: any = { url: path, method: 'GET', headers };
    // Provide headersDistinct expected by BaseRequest
    req.headersDistinct = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), [v]])
    );
    return req as http.IncomingMessage;
  }

  function mockRes() {
    const headers: Record<string, string> = {};
    const chunks: Buffer[] = [];
    const res: any = {
      headersSent: false,
      statusCode: 200,
      statusMessage: 'OK',
  on: (_event: string, _listener: unknown) => {},
  once: (_event: string, _listener: unknown) => {},
      removeAllListeners: () => {},
      writeHead: function(code: number, _headers: Record<string, string>) { this.headersSent = true; this.statusCode = code; Object.assign(headers, _headers); },
      end: function(data?: Buffer | string) { if (data) chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data)); this.headersSent = true; this._ended = true; },
      write: function(data: Buffer | string) { chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data)); },
      get body() { return Buffer.concat(chunks).toString('utf-8'); },
      setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; },
      getHeader: (k: string) => headers[k.toLowerCase()],
      getHeaders: () => headers,
      hasHeader: (k: string) => k.toLowerCase() in headers,
    };
    return res;
  }

  it('honors declarative per-action timeout longer than global', async () => {
    @registerDi()
    class TestModule extends BaseModule {
      @request({ topic: '/get/slow', timeout: 120 })
      async slow({ context }: any) {
        await WAIT(60); // exceeds global (50) but below declarative (120)
        await context.res.text('OK');
      }
    }

    const config: Partial<BaseRequestHandlerConfig> = { requestTimeout: 50, port: 0 };
  BaseDi.register(config, { key: 'Config.BaseRequestHandler' });
  // instantiate via DI so action lookup & validation succeeds
  BaseDi.resolve(TestModule);

  const handler = BaseDi.resolve(BaseRequestHandler);
  const req = mockReq('/slow');
  const res = mockRes();
  const ctx = new BaseHttpContext(req, res);
  await (handler as any).handleContext(ctx);
  await WAIT(90);
    assert.strictEqual(res.statusCode, 200, 'Should not have timed out');
    assert.match(res.body, /OK/);
  });

  it('times out when exceeding global and no declarative override', async () => {
    @registerDi()
    class TestModule2 extends BaseModule {
      @request('/get/short')
      async short({ context }: any) {
        await WAIT(70); // exceeds global 50
        await context.res.text('DONE');
      }
    }
  BaseDi.register({ requestTimeout: 50, port: 0 }, { key: 'Config.BaseRequestHandler' });
  BaseDi.resolve(TestModule2);
    const handler = BaseDi.resolve(BaseRequestHandler);
    const req = mockReq('/short');
    const res = mockRes();
    const ctx = new BaseHttpContext(req, res);
    await (handler as any).handleContext(ctx);
  await WAIT(100);
    assert.strictEqual(res.statusCode, 408, 'Should have timed out');
    assert.match(res.body, /timed out/i);
  });

  it('extends timeout dynamically via res.extendTimeout()', async () => {
    @registerDi()
    class TestModule3 extends BaseModule {
      @request('/get/dynamic')
      async dyn({ context }: any) {
        await WAIT(30);
        context.res.extendTimeout(60); // extend before original 40ms timeout
        await WAIT(40); // total ~70ms > original, < extended
        await context.res.text('DYNAMIC OK');
      }
    }
  BaseDi.register({ requestTimeout: 40, port: 0 }, { key: 'Config.BaseRequestHandler' });
  BaseDi.resolve(TestModule3);
    const handler = BaseDi.resolve(BaseRequestHandler);
    const req = mockReq('/dynamic');
    const res = mockRes();
    const ctx = new BaseHttpContext(req, res);
    await (handler as any).handleContext(ctx);
  await WAIT(90);
    assert.strictEqual(res.statusCode, 200, 'Should succeed after extension');
    assert.match(res.body, /DYNAMIC OK/);
  });

  it('uses maximum timeout among multiple matched actions (including middleware)', async () => {
    @registerDi()
    class MultiModule extends BaseModule {
      @request({ topic: '/get/multi', timeout: 200, middleware: true })
      async mw() { /* middleware just present */ }

      @request({ topic: '/get/multi', timeout: 150 })
      async handler({ context }: any) {
        await WAIT(160); // exceeds 150 but below 200
        await context.res.text('MULTI OK');
      }
    }

  BaseDi.register({ requestTimeout: 50, port: 0 }, { key: 'Config.BaseRequestHandler' });
  BaseDi.resolve(MultiModule);
    const handler = BaseDi.resolve(BaseRequestHandler);
    const req = mockReq('/multi');
    const res = mockRes();
    const ctx = new BaseHttpContext(req, res);
    await (handler as any).handleContext(ctx);
  await WAIT(210);
    assert.strictEqual(res.statusCode, 200, 'Should succeed using longest timeout (200ms)');
    assert.match(res.body, /MULTI OK/);
  });
});
