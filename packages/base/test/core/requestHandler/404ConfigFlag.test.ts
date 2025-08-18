import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'events';
import { BaseDi } from '../../../src/core/di/baseDi.js';
import { BasePubSub } from '../../../src/core/pubsub/basePubSub.js';
import { BaseLogger } from '../../../src/core/logger/baseLogger.js';
import { BaseRouter } from '../../../src/core/requestHandler/baseRouter.js';
import { BaseRequestHandler } from '../../../src/core/requestHandler/baseRequestHandler.js';
import type * as http from 'http';
import { BaseHttpContext } from '../../../src/core/requestHandler/httpContext.js';

function mockReq(path: string): http.IncomingMessage {
  const headers = { host: 'localhost' } as Record<string,string>;
  const req: any = { url: path, method: 'GET', headers };
  req.headersDistinct = Object.fromEntries(Object.entries(headers).map(([k,v]) => [k.toLowerCase(), [v]]));
  return req as http.IncomingMessage;
}

function mockRes() {
  const chunks: Buffer[] = [];
  const headers: Record<string,string> = {};
  const raw = new EventEmitter();
  // Ensure removeListener exists (EventEmitter has it) but we expose explicitly in case of typing
  (raw as any).removeListener = raw.removeListener.bind(raw);
  const res: any = {
    headersSent: false,
    statusCode: 200,
    on: raw.on.bind(raw),
  removeListener: raw.removeListener.bind(raw),
    writeHead(code: number, _h: Record<string,string>) { this.headersSent = true; this.statusCode = code; Object.assign(headers, _h); },
    end(data?: string|Buffer) { if (data) chunks.push(Buffer.isBuffer(data)? data: Buffer.from(data)); this.headersSent = true; setImmediate(()=> raw.emit('finish')); },
    setHeader(k: string, v: string) { headers[k.toLowerCase()] = v; },
    get body() { return Buffer.concat(chunks).toString('utf-8'); },
    rawResponse: raw
  };
  return res;
}

describe('404 treat404AsError flag', () => {
  beforeEach(() => {
    BaseDi.reset();
    BaseDi.register(BasePubSub, { singleton: true });
    BaseDi.register(BaseLogger, { key: 'BaseLogger', singleton: true });
    BaseDi.register(BaseRouter, { singleton: true });
    BaseDi.register(BaseRequestHandler, { singleton: true });
    BaseDi.register({ routes: {}, defaultRoute: '/' }, { key: 'Config.BaseRouter' });
  });

  afterEach(async () => { await BaseDi.teardown(); });

  it('404 yields done when flag false (default)', async () => {
    BaseDi.register({ requestTimeout: 50, port: 0, treat404AsError: false }, { key: 'Config.BaseRequestHandler' });
    const req = mockReq('/missing1');
    const res = mockRes();
  const ctx = new BaseHttpContext(req, res);
    await BaseDi.resolve(BasePubSub).once(`/request/${ctx.id}/final`);
    assert.strictEqual(res.statusCode, 404);
    assert.match(res.body, /Not Found/);
    assert.strictEqual(ctx.state, 'done');
  });

  it('404 yields error when flag true', async () => {
    BaseDi.register({ requestTimeout: 50, port: 0, treat404AsError: true }, { key: 'Config.BaseRequestHandler' });
    const req = mockReq('/missing2');
    const res = mockRes();
  const ctx = new BaseHttpContext(req, res);
    await BaseDi.resolve(BasePubSub).once(`/request/${ctx.id}/final`);
    assert.strictEqual(res.statusCode, 404);
    assert.match(res.body, /Not Found/);
    assert.strictEqual(ctx.state, 'error');
  });
});
