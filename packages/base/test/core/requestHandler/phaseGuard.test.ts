import { describe, it } from 'node:test';
import assert from 'node:assert';
import { request } from '../../../src/core/requestHandler/decorators/request.js';
import { type BaseAction } from '../../../src/core/module/types.js';

// Minimal simulation of decorator application without running initializers
type InitFn = () => void;
interface FakeDecoratorContext { addInitializer(fn: InitFn): void }
function applyRequestDecorator(opts: any) {
  const dec = request(opts);
  const fn: any = async () => {};
  const initializers: InitFn[] = [];
  const ctx = { addInitializer(f: InitFn) { initializers.push(f); } } as unknown as FakeDecoratorContext;
  // @ts-expect-error using simplified fake context shape
  dec(fn, ctx); // may throw
  return { fn: fn as BaseAction, initializers };
}

describe('Request phase guard', () => {
  it('throws when using phase < 50 without _internal', () => {
    assert.throws(() => applyRequestDecorator({ topic: '/get/bad', phase: 40 }), /Request action phase must be >= 50/);
  });

  it('does not throw when using phase < 50 with _internal', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    assert.doesNotThrow(() => applyRequestDecorator({ topic: '/get/good', phase: 40, _internal: true }));
  });
});
