import { test } from 'node:test';
import * as assert from 'node:assert';
import {
  recursiveMap,
  merge,
  type GetTransformerFunction
} from '../../src/utils/recursion';

test('recursiveMap function', (t) => {
  t.test('should handle primitive values', () => {
    assert.strictEqual(recursiveMap('hello'), 'hello');
    assert.strictEqual(recursiveMap(42), 42);
    assert.strictEqual(recursiveMap(true), true);
    assert.strictEqual(recursiveMap(null), null);
    assert.strictEqual(recursiveMap(undefined), undefined);
  });

  t.test('should handle simple objects', () => {
    const input = { a: 1, b: 'test', c: true };
    const result = recursiveMap(input);
    
    assert.deepStrictEqual(result, { a: 1, b: 'test', c: true });
    assert.notStrictEqual(result, input); // Should be a copy
  });

  t.test('should handle arrays', () => {
    const input = [1, 'test', true, null];
    const result = recursiveMap(input);
    
    assert.deepStrictEqual(result, [1, 'test', true, null]);
    assert.notStrictEqual(result, input); // Should be a copy
  });

  t.test('should handle nested objects', () => {
    const input = {
      level1: {
        level2: {
          level3: 'deep value'
        },
        array: [1, 2, { nested: 'in array' }]
      }
    };
    const result = recursiveMap(input);
    
    assert.deepStrictEqual(result, input);
    assert.notStrictEqual(result, input);
    assert.notStrictEqual(result.level1, input.level1);
    assert.notStrictEqual(result.level1.level2, input.level1.level2);
  });

  t.test('should apply custom transformers', () => {
    const input = {
      name: 'john',
      age: 25,
      nested: {
        city: 'new york'
      }
    };

    const getTransformer: GetTransformerFunction = (value) => {
      if (typeof value === 'string') {
        return (val: unknown) => (val as string).toUpperCase();
      }
      return null;
    };

    const result = recursiveMap(input, {}, getTransformer);
    
    assert.deepStrictEqual(result, {
      name: 'JOHN',
      age: 25,
      nested: {
        city: 'NEW YORK'
      }
    });
  });

  t.test('should respect maxDepth option', () => {
    const input = {
      level1: {
        level2: {
          level3: {
            level4: 'too deep'
          }
        }
      }
    };

    const result = recursiveMap(input, { maxDepth: 2 });
    
    assert.deepStrictEqual(result, {
      level1: {
        level2: {}
      }
    });
  });

  t.test('should respect maxItems option for objects', () => {
    const input = { a: 1, b: 2, c: 3, d: 4, e: 5 };
    const result = recursiveMap(input, { maxItems: 3 });
    
    const resultKeys = Object.keys(result as Record<string, unknown>);
    assert.strictEqual(resultKeys.length, 3);
    assert.deepStrictEqual(result, { a: 1, b: 2, c: 3 });
  });

  t.test('should respect maxItems option for arrays', () => {
    const input = [1, 2, 3, 4, 5];
    const result = recursiveMap(input, { maxItems: 3 });
    
    assert.deepStrictEqual(result, [1, 2, 3]);
  });

  t.test('should handle circular references', () => {
    const input: Record<string, unknown> = { a: 1 };
    input.self = input;

    const result = recursiveMap(input);
    
    assert.strictEqual(result.a, 1);
    assert.strictEqual(result.self, result); // Should reference the copy, not original
  });

  t.test('should handle complex circular references', () => {
    const obj1: Record<string, unknown> = { name: 'obj1' };
    const obj2: Record<string, unknown> = { name: 'obj2' };
    obj1.ref = obj2;
    obj2.ref = obj1;
    
    const input = { first: obj1, second: obj2 };
    const result = recursiveMap(input);
    
    assert.strictEqual(result.first.name, 'obj1');
    assert.strictEqual(result.second.name, 'obj2');
    assert.strictEqual(result.first.ref, result.second);
    assert.strictEqual(result.second.ref, result.first);
  });

  t.test('should handle mixed arrays and objects', () => {
    const input = {
      users: [
        { name: 'Alice', scores: [95, 87, 92] },
        { name: 'Bob', scores: [88, 90, 85] }
      ],
      metadata: {
        total: 2,
        active: true
      }
    };

    const result = recursiveMap(input);
    
    assert.deepStrictEqual(result, input);
    assert.notStrictEqual(result, input);
  });

  t.test('should work with transformer that returns objects', () => {
    const input = { numbers: [1, 2, 3] };
    
    const getTransformer: GetTransformerFunction = (value) => {
      if (typeof value === 'number') {
        return (val: unknown) => ({ value: val, squared: (val as number) ** 2 });
      }
      return null;
    };

    const result = recursiveMap(input, {}, getTransformer);
    
    assert.deepStrictEqual(result, {
      numbers: [
        { value: 1, squared: 1 },
        { value: 2, squared: 4 },
        { value: 3, squared: 9 }
      ]
    });
  });
});

test('merge function', (t) => {
  t.test('should merge simple objects', () => {
    const base = { a: 1, b: 2 };
    const apply = { b: 3, c: 4 };
    const result = merge(base, apply);
    
    assert.deepStrictEqual(result, { a: 1, b: 3, c: 4 });
    assert.notStrictEqual(result, base); // Should not mutate original
  });

  t.test('should merge nested objects recursively', () => {
    const base = {
      user: {
        name: 'John',
        age: 30,
        address: {
          city: 'New York',
          zip: '10001'
        }
      },
      settings: {
        theme: 'dark'
      }
    };

    const apply = {
      user: {
        age: 31,
        address: {
          zip: '10002',
          country: 'USA'
        },
        email: 'john@example.com'
      },
      settings: {
        language: 'en'
      }
    };

    const result = merge(base, apply);
    
    assert.deepStrictEqual(result, {
      user: {
        name: 'John',
        age: 31,
        address: {
          city: 'New York',
          zip: '10002',
          country: 'USA'
        },
        email: 'john@example.com'
      },
      settings: {
        theme: 'dark',
        language: 'en'
      }
    });
  });

  t.test('should overwrite arrays instead of merging them', () => {
    const base = {
      tags: ['old', 'existing'],
      scores: [1, 2, 3]
    };

    const apply = {
      tags: ['new'],
      scores: [4, 5]
    };

    const result = merge(base, apply);
    
    assert.deepStrictEqual(result, {
      tags: ['new'],
      scores: [4, 5]
    });
  });

  t.test('should overwrite primitives', () => {
    const base = {
      name: 'John',
      age: 30,
      active: true
    };

    const apply = {
      name: 'Jane',
      age: 25,
      active: false
    };

    const result = merge(base, apply);
    
    assert.deepStrictEqual(result, {
      name: 'Jane',
      age: 25,
      active: false
    });
  });

  t.test('should handle null and undefined values', () => {
    const base = {
      a: 'value',
      b: { nested: 'data' },
      c: 'keep'
    };

    const apply = {
      a: null,
      b: undefined,
      d: 'new'
    };

    const result = merge(base, apply);
    
    assert.deepStrictEqual(result, {
      a: null,
      b: undefined,
      c: 'keep',
      d: 'new'
    });
  });

  t.test('should handle empty objects', () => {
    const base = { a: 1, b: 2 };
    const apply = {};
    const result = merge(base, apply);
    
    assert.deepStrictEqual(result, { a: 1, b: 2 });
  });

  t.test('should handle merging into empty object', () => {
    const base = {};
    const apply = { a: 1, b: { nested: 'value' } };
    const result = merge(base, apply);
    
    assert.deepStrictEqual(result, { a: 1, b: { nested: 'value' } });
  });

  t.test('should not mutate original objects', () => {
    const base = { a: 1, nested: { b: 2 } };
    const apply = { nested: { c: 3 } };
    
    const originalBase = JSON.parse(JSON.stringify(base));
    const originalApply = JSON.parse(JSON.stringify(apply));
    
    merge(base, apply);
    
    assert.deepStrictEqual(base, originalBase);
    assert.deepStrictEqual(apply, originalApply);
  });

  t.test('should handle complex nested merging', () => {
    const base = {
      config: {
        database: {
          host: 'localhost',
          port: 5432,
          options: {
            ssl: false,
            timeout: 30
          }
        },
        cache: {
          enabled: true,
          ttl: 3600
        }
      }
    };

    const apply = {
      config: {
        database: {
          host: 'remote-host',
          options: {
            ssl: true,
            poolSize: 10
          }
        },
        api: {
          version: 'v1'
        }
      }
    };

    const result = merge(base, apply);
    
    assert.deepStrictEqual(result, {
      config: {
        database: {
          host: 'remote-host',
          port: 5432,
          options: {
            ssl: true,
            timeout: 30,
            poolSize: 10
          }
        },
        cache: {
          enabled: true,
          ttl: 3600
        },
        api: {
          version: 'v1'
        }
      }
    });
  });

  t.test('should handle arrays in nested objects correctly', () => {
    const base = {
      data: {
        items: [1, 2, 3],
        metadata: {
          count: 3
        }
      }
    };

    const apply = {
      data: {
        items: [4, 5],
        metadata: {
          updated: true
        }
      }
    };

    const result = merge(base, apply);
    
    assert.deepStrictEqual(result, {
      data: {
        items: [4, 5], // Array should be overwritten
        metadata: {
          count: 3,     // Nested object should be merged
          updated: true
        }
      }
    });
  });
});
