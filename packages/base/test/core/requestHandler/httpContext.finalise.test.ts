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

// Helper delay (aligns with existing tests)
const WAIT = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Minimal mock IncomingMessage
function mockReq(path: string): http.IncomingMessage {
  const headers = { host: 'localhost' } as Record<string,string>;
  const req: any = new EventEmitter();
  req.url = path;
  req.method = 'GET';
  req.headers = headers;
  req.headersDistinct = Object.fromEntries(Object.entries(headers).map(([k,v]) => [k.toLowerCase(), [v]]));
  return req as http.IncomingMessage;
}

// Raw ServerResponse stub implementing required pieces + EventEmitter
class RawRes extends EventEmitter {
  headersSent = false;
  statusCode = 200;
  statusMessage = 'OK';
  private headers: Record<string,string> = {};
  private bodyChunks: Buffer[] = [];
  private emittedFinish = false;
  writeHead(code: number, headers?: http.OutgoingHttpHeaders | http.OutgoingHttpHeader[], statusMessage?: string) {
    this.headersSent = true;
    this.statusCode = code;
    if (typeof statusMessage === 'string') this.statusMessage = statusMessage;
    if (headers && !Array.isArray(headers)) Object.assign(this.headers, headers as Record<string,string>);
    return this as unknown as http.ServerResponse;
  }
  end(chunk?: any, encoding?: any, cb?: any) {
    if (chunk) this.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    if (typeof encoding === 'function') encoding();
    if (typeof cb === 'function') cb();
    if (!this.emittedFinish) {
      this.emittedFinish = true;
      setImmediate(() => this.emit('finish'));
    }
    return this as unknown as http.ServerResponse;
  }
  write(chunk: any, encoding?: any, cb?: any) {
    this.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    if (typeof encoding === 'function') encoding();
    if (typeof cb === 'function') cb();
    return true;
  }
  getHeader(name: string) { return this.headers[name.toLowerCase()]; }
  getHeaders() { return { ...this.headers }; }
  hasHeader(name: string) { return name.toLowerCase() in this.headers; }
  setHeader(name: string, value: string | number | readonly string[]) { this.headers[name.toLowerCase()] = String(value); return this as unknown as http.ServerResponse; }
  removeHeader(name: string) { delete this.headers[name.toLowerCase()]; }
  get body() { return Buffer.concat(this.bodyChunks).toString('utf-8'); }
}

describe('BaseHttpContext finalise & error handling', () => {
  beforeEach(() => {
    BaseDi.reset();
    BaseDi.register(BasePubSub, { singleton: true });
    BaseDi.register(BaseLogger, { key: 'BaseLogger', singleton: true });
    BaseDi.register(BaseRouter, { singleton: true });
    BaseDi.register(BaseRequestHandler, { singleton: true });
    // Minimal router config
    BaseDi.register({ routes: {}, defaultRoute: '/' }, { key: 'Config.BaseRouter' });
  });

  afterEach(async () => {
    await BaseDi.teardown();
  });

  it('returns 404 and leaves context in done state (non-error)', async () => {
    // Config with short timeout to ensure timer armed + cleared
    const config: Partial<BaseRequestHandlerConfig> = { requestTimeout: 50, port: 0 };
    BaseDi.register(config, { key: 'Config.BaseRequestHandler' });

    const req = mockReq('/nope');
    const raw = new RawRes();
    const ctx = new BaseHttpContext(req, raw as any);

  // Wait for closed event to ensure finalise executed
  await BaseDi.resolve(BasePubSub).once(`/request/${ctx.id}/closed`);

  assert.strictEqual(raw.statusCode, 404, 'Should set 404 for unhandled route');
  assert.match(raw.body, /Not Found/);
  assert.strictEqual(ctx.state, 'done', 'Context should now be done for 404');
  // After finalise its own listener should be removed (others from BaseResponse may remain)
  const finishNames = raw.listeners('finish').map(fn => (fn as any).name);
  assert(!finishNames.includes('finalise'), 'finalise listener should be removed from finish');
  const closeNames = raw.listeners('close').map(fn => (fn as any).name);
  assert(!closeNames.includes('finalise'), 'finalise listener should be removed from close');
  });

  it('returns 500 and preserves error state on coordination failure (phase paradox)', async () => {
    @registerDi()
    class ParadoxModule extends BaseModule {
      @request({ topic: '/get/bad', phase: 100 })
      async first() { /* noop */ }

      @request({ topic: '/get/bad', phase: 150 })
      async second() { /* noop */ }
    }

    const config: Partial<BaseRequestHandlerConfig> = { requestTimeout: 100, port: 0 };
    BaseDi.register(config, { key: 'Config.BaseRequestHandler' });
    const mod = BaseDi.resolve(ParadoxModule) as any;
    // Create paradox: earlier phase depends on later phase
    mod.first.dependsOn = ['ParadoxModule/second'];

    const req = mockReq('/bad');
    const raw = new RawRes();
    const ctx = new BaseHttpContext(req, raw as any);

    await WAIT(10);

    assert.strictEqual(raw.statusCode, 500, 'Should set 500 for coordination error');
    assert.match(raw.body, /Internal Server Error/);
    assert.strictEqual(ctx.state, 'error', 'Context should remain error (finalise must not set done)');
  });

  it('finalise only runs once even if finish emitted multiple times', async () => {
    const config: Partial<BaseRequestHandlerConfig> = { requestTimeout: 50, port: 0 };
    BaseDi.register(config, { key: 'Config.BaseRequestHandler' });

    const req = mockReq('/nope2');
    const raw = new RawRes();
    const ctx = new BaseHttpContext(req, raw as any);
    await WAIT(10);
    const stateAfterFirst = ctx.state;
    raw.emit('finish'); // emit again artificially
    await WAIT(5);
    assert.strictEqual(ctx.state, stateAfterFirst, 'State should not change after duplicate finish');
  });
});
