import { test } from 'node:test';
import * as assert from 'node:assert';
import { delay, asyncMap, asyncFilter } from '../../src/utils/async';

test('delay function', (t) => {
  t.test('should resolve immediately with no timeout', async () => {
    const start = Date.now();
    await delay();
    const elapsed = Date.now() - start;
    // Should be very fast (< 10ms) since it uses setImmediate
    assert.ok(elapsed < 10);
  });

  t.test('should resolve immediately with 0 timeout', async () => {
    const start = Date.now();
    await delay(0);
    const elapsed = Date.now() - start;
    // Should be very fast (< 10ms) since it uses setImmediate
    assert.ok(elapsed < 10);
  });

  t.test('should delay for specified timeout', async () => {
    const timeout = 50;
    const start = Date.now();
    await delay(timeout);
    const elapsed = Date.now() - start;
    // Should be close to timeout (allow some variance)
    assert.ok(elapsed >= timeout - 5);
    assert.ok(elapsed < timeout + 20);
  });
});

test('asyncMap function', (t) => {
  t.test('should map over regular array', async () => {
    const input = [1, 2, 3, 4];
    const result = await asyncMap(input, async (n) => n * 2);
    assert.deepStrictEqual(result, [2, 4, 6, 8]);
  });

  t.test('should filter out undefined results', async () => {
    const input = [1, 2, 3, 4];
    const result = await asyncMap(input, async (n) => n % 2 === 0 ? n * 2 : undefined);
    assert.deepStrictEqual(result, [4, 8]);
  });

  t.test('should handle empty array', async () => {
    const result = await asyncMap([], async (n) => n);
    assert.deepStrictEqual(result, []);
  });

  t.test('should work with Promise<Iterable>', async () => {
    const input = Promise.resolve([1, 2, 3]);
    const result = await asyncMap(input, async (n) => n * 2);
    assert.deepStrictEqual(result, [2, 4, 6]);
  });

  t.test('should work with async iterable', async () => {
    async function* asyncGenerator() {
      yield 1;
      yield 2;
      yield 3;
    }
    
    const result = await asyncMap(asyncGenerator(), async (n) => n * 2);
    assert.deepStrictEqual(result, [2, 4, 6]);
  });

  t.test('should work with Promise<AsyncIterable>', async () => {
    async function* asyncGenerator() {
      yield 1;
      yield 2;
      yield 3;
    }
    
    const input = Promise.resolve(asyncGenerator());
    const result = await asyncMap(input, async (n) => n * 2);
    assert.deepStrictEqual(result, [2, 4, 6]);
  });

  t.test('should handle async functions that return undefined', async () => {
    const input = [1, 2, 3, 4];
    const result = await asyncMap(input, async (n) => {
      if (n > 2) return n;
      return undefined;
    });
    assert.deepStrictEqual(result, [3, 4]);
  });

  t.test('should preserve order with async operations', async () => {
    const input = [1, 2, 3];
    const result = await asyncMap(input, async (n) => {
      // Delay longer for smaller numbers to test order preservation
      await delay(10 - n);
      return n * 2;
    });
    assert.deepStrictEqual(result, [2, 4, 6]);
  });
});

test('asyncFilter function', (t) => {
  t.test('should filter array with custom predicate', async () => {
    const input = [1, 2, 3, 4, 5];
    const result = await asyncFilter(input, async (n) => n % 2 === 0);
    assert.deepStrictEqual(result, [2, 4]);
  });

  t.test('should use default predicate (truthy values)', async () => {
    const input = [0, 1, '', 'hello', null, 'world', false, true];
    const result = await asyncFilter(input);
    assert.deepStrictEqual(result, [1, 'hello', 'world', true]);
  });

  t.test('should handle empty array', async () => {
    const result = await asyncFilter([]);
    assert.deepStrictEqual(result, []);
  });

  t.test('should work with Promise<Iterable>', async () => {
    const input = Promise.resolve([1, 2, 3, 4, 5]);
    const result = await asyncFilter(input, async (n) => n > 3);
    assert.deepStrictEqual(result, [4, 5]);
  });

  t.test('should work with async iterable', async () => {
    async function* asyncGenerator() {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
      yield 5;
    }
    
    const result = await asyncFilter(asyncGenerator(), async (n) => n % 2 === 1);
    assert.deepStrictEqual(result, [1, 3, 5]);
  });

  t.test('should work with Promise<AsyncIterable>', async () => {
    async function* asyncGenerator() {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
    }
    
    const input = Promise.resolve(asyncGenerator());
    const result = await asyncFilter(input, async (n) => n > 2);
    assert.deepStrictEqual(result, [3, 4]);
  });

  t.test('should handle async predicate with delays', async () => {
    const input = [1, 2, 3, 4];
    const result = await asyncFilter(input, async (n) => {
      await delay(1); // Small delay to test async behavior
      return n <= 2;
    });
    assert.deepStrictEqual(result, [1, 2]);
  });

  t.test('should preserve order with async predicate', async () => {
    const input = [1, 2, 3, 4, 5];
    const result = await asyncFilter(input, async (n) => {
      // Delay longer for larger numbers
      await delay(n);
      return n % 2 === 1;
    });
    assert.deepStrictEqual(result, [1, 3, 5]);
  });

  t.test('should handle all false predicate', async () => {
    const input = [1, 2, 3, 4];
    const result = await asyncFilter(input, async () => false);
    assert.deepStrictEqual(result, []);
  });

  t.test('should handle all true predicate', async () => {
    const input = [1, 2, 3, 4];
    const result = await asyncFilter(input, async () => true);
    assert.deepStrictEqual(result, [1, 2, 3, 4]);
  });
});
