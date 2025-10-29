import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'events';
import type * as http from 'http';
import { BaseHttpContext } from '../../../src/core/requestHandler/httpContext.js';
import { BaseDi } from '../../../src/core/di/baseDi.js';
import { BasePubSub } from '../../../src/core/pubsub/basePubSub.js';
import { BaseLogger } from '../../../src/core/logger/baseLogger.js';
import { BaseRequestHandler, type BaseRequestHandlerConfig } from '../../../src/core/requestHandler/baseRequestHandler.js';
import { BaseRouter } from '../../../src/core/requestHandler/baseRouter.js';
import { request } from '../../../src/core/requestHandler/decorators/request.js';
import { BaseModule } from '../../../src/core/module/baseModule.js';
import { registerDi } from '../../../src/core/di/decorators/registerDi.js';
import { getMockWebSocketManager } from '../../testUtils/utils.js';
import type { Duplex } from 'stream';
import { WebSocket } from 'ws';

const WAIT = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function mockReq(path: string): http.IncomingMessage {
  const headers = { host: 'localhost' } as Record<string,string>;
  const req: any = new EventEmitter();
  req.url = path;
  req.method = 'GET';
  req.headers = headers;
  req.headersDistinct = Object.fromEntries(Object.entries(headers).map(([k,v]) => [k.toLowerCase(), [v]]));
  return req as http.IncomingMessage;
}

class RawRes extends EventEmitter {
  headersSent = false;
  statusCode = 200;
  statusMessage = 'OK';
  private headers: Record<string,string> = {};
  private bodyChunks: Buffer[] = [];
  private emittedFinish = false;
  writeHead(code: number, headers?: http.OutgoingHttpHeaders | http.OutgoingHttpHeader[]) { this.headersSent = true; this.statusCode = code; if (headers && !Array.isArray(headers)) Object.assign(this.headers, headers as Record<string,string>); return this as unknown as http.ServerResponse; }
  end(chunk?: any) { if (chunk) this.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))); if (!this.emittedFinish) { this.emittedFinish = true; setImmediate(()=> this.emit('finish')); } return this as unknown as http.ServerResponse; }
  get body() { return Buffer.concat(this.bodyChunks).toString('utf-8'); }
  setHeader(n: string, v: string) { this.headers[n.toLowerCase()] = v; }
  getHeader(n: string) { return this.headers[n.toLowerCase()]; }
  hasHeader(n: string) { return n.toLowerCase() in this.headers; }
}

describe('BaseHttpContext additional scenarios', () => {
  beforeEach(() => {
    BaseDi.reset();
    BaseDi.register(BasePubSub, { singleton: true });
    BaseDi.register(BaseLogger, { key: 'BaseLogger', singleton: true });
    BaseDi.register(BaseRouter, { singleton: true });
    BaseDi.register(BaseRequestHandler, { singleton: true });
    BaseDi.register({ routes: {}, defaultRoute: '/' }, { key: 'Config.BaseRouter' });
  });

  afterEach(async () => { await BaseDi.teardown(); });

  it('timeout sets status 408 and context error state', async () => {
    @registerDi()
    class SlowModule extends BaseModule {
      @request('/get/slowtimeout')
      async slow({ context }: any) {
        // exceed global timeout
        await WAIT(50);
        await context.res.text('LATE');
      }
    }
    const config: Partial<BaseRequestHandlerConfig> = { requestTimeout: 20, port: 0 };
    BaseDi.register(config, { key: 'Config.BaseRequestHandler' });
    BaseDi.resolve(SlowModule);
    const req = mockReq('/slowtimeout');
    const raw = new RawRes();
    const ctx = new BaseHttpContext(req, raw as any);
  let timeoutEvent = false;
  BaseDi.resolve(BasePubSub).sub(`/request/${ctx.id}/timeout`, async () => { timeoutEvent = true; });
  await WAIT(70);
    assert.strictEqual(raw.statusCode, 408);
    assert.match(raw.body, /timed out/i);
    assert.strictEqual(ctx.state, 'error');
  assert.strictEqual(timeoutEvent, true, 'Timeout event should have been published');
  });

  it('404 now results in done state (non-error)', async () => {
    const config: Partial<BaseRequestHandlerConfig> = { requestTimeout: 50, port: 0 };
    BaseDi.register(config, { key: 'Config.BaseRequestHandler' });
    const req = mockReq('/missing');
    const raw = new RawRes();
    const ctx = new BaseHttpContext(req, raw as any);
  let notFoundEvent = false;
  BaseDi.resolve(BasePubSub).sub(`/request/${ctx.id}/notfound`, async () => { notFoundEvent = true; });
  await BaseDi.resolve(BasePubSub).once(`/request/${ctx.id}/closed`);
    assert.strictEqual(raw.statusCode, 404);
    assert.match(raw.body, /Not Found/);
    assert.strictEqual(ctx.state, 'done');
  assert.strictEqual(notFoundEvent, true, 'NotFound event should have been published');
  });

  it('internal action error returns 500 and leaves error state', async () => {
    @registerDi()
    class ErrModule extends BaseModule {
      @request('/get/oops')
      async boom() { throw new Error('kaboom'); }
    }
    // Plenty of time so timeout does not interfere
    BaseDi.register({ requestTimeout: 500, port: 0 }, { key: 'Config.BaseRequestHandler' });
    BaseDi.resolve(ErrModule);
  const req = mockReq('/oops');
    const raw = new RawRes();
    const ctx = new BaseHttpContext(req, raw as any);
  let errorEvent = false;
  BaseDi.resolve(BasePubSub).sub(`/request/${ctx.id}/error`, async () => { errorEvent = true; });
  await BaseDi.resolve(BasePubSub).once(`/request/${ctx.id}/closed`);
    assert.strictEqual(raw.statusCode, 500);
    assert.match(raw.body, /Internal Server Error/);
    assert.strictEqual(ctx.state, 'error');
  assert.strictEqual(errorEvent, true, 'Error event should have been published');
  });

  it('upgrade path: calling upgrade marks original HTTP context done and closed published', async () => {
    const req = mockReq('/chat');
    const socket = { destroy: () => {} } as unknown as Duplex;
    const head = Buffer.from('x');
    const wss = { handleUpgrade: (_r: any,_s: any,_h: any, cb: any) => { const ws = { readyState: WebSocket.OPEN, on: ()=>{}, send: ()=>{} }; cb(ws); } } as any;
    BaseDi.register(getMockWebSocketManager(), { key: 'BaseWebSocketManager', singleton: true, type: 'scalar' });
    BaseDi.register({ requestTimeout: 50, port: 0 }, { key: 'Config.BaseRequestHandler' });
    const ctx = new BaseHttpContext(req, undefined, socket, head, wss);
    assert.strictEqual(ctx.isUpgradable, true);
    ctx.upgrade();
    assert.strictEqual(ctx.state, 'done');
  });
});
