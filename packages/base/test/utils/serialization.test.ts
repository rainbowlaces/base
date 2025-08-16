import { test } from 'node:test';
import * as assert from 'node:assert';
import { serialize } from '../../src/utils/serialization.js';
import { type Serializable, type JsonValue } from '../../src/core/types.js';

test('serialize function', (t) => {
  t.test('should handle null and undefined', () => {
    assert.strictEqual(serialize(null), null);
    assert.strictEqual(serialize(undefined), undefined);
  });

  t.test('should handle primitive values', () => {
    assert.strictEqual(serialize('string'), 'string');
    assert.strictEqual(serialize(42), 42);
    assert.strictEqual(serialize(true), true);
    assert.strictEqual(serialize(false), false);
  });

  t.test('should serialize Date objects to ISO strings', () => {
    const date = new Date('2025-01-01T12:00:00.000Z');
    assert.strictEqual(serialize(date), '2025-01-01T12:00:00.000Z');
  });

  t.test('should serialize arrays recursively', () => {
    const input = [1, 'test', null, true, new Date('2025-01-01T12:00:00.000Z')];
    const expected = [1, 'test', null, true, '2025-01-01T12:00:00.000Z'];
    assert.deepStrictEqual(serialize(input), expected);
  });

  t.test('should serialize nested arrays', () => {
    const input = [1, [2, [3, 4]], 5];
    const expected = [1, [2, [3, 4]], 5];
    assert.deepStrictEqual(serialize(input), expected);
  });

  t.test('should serialize plain objects', () => {
    const input = {
      name: 'test',
      age: 25,
      active: true,
      nothing: null
    };
    const expected = {
      name: 'test',
      age: 25,
      active: true,
      nothing: null
    };
    assert.deepStrictEqual(serialize(input), expected);
  });

  t.test('should serialize nested objects', () => {
    const input = {
      user: {
        name: 'John',
        profile: {
          age: 30,
          settings: {
            theme: 'dark'
          }
        }
      }
    };
    assert.deepStrictEqual(serialize(input), input);
  });

  t.test('should serialize objects with Date properties', () => {
    const input = {
      name: 'event',
      createdAt: new Date('2025-01-01T12:00:00.000Z'),
      updatedAt: new Date('2025-01-02T12:00:00.000Z')
    };
    const expected = {
      name: 'event',
      createdAt: '2025-01-01T12:00:00.000Z',
      updatedAt: '2025-01-02T12:00:00.000Z'
    };
    assert.deepStrictEqual(serialize(input), expected);
  });

  t.test('should handle mixed arrays and objects', () => {
    const input = {
      items: [
        { id: 1, date: new Date('2025-01-01T12:00:00.000Z') },
        { id: 2, date: new Date('2025-01-02T12:00:00.000Z') }
      ],
      meta: {
        total: 2,
        created: new Date('2025-01-01T10:00:00.000Z')
      }
    };
    const expected = {
      items: [
        { id: 1, date: '2025-01-01T12:00:00.000Z' },
        { id: 2, date: '2025-01-02T12:00:00.000Z' }
      ],
      meta: {
        total: 2,
        created: '2025-01-01T10:00:00.000Z'
      }
    };
    assert.deepStrictEqual(serialize(input), expected);
  });

  t.test('should call serialize method on Serializable objects', () => {
    class CustomClass implements Serializable {
      constructor(private value: string) {}
      
      serialize(): JsonValue {
        return { customValue: this.value, type: 'custom' };
      }
    }

    const instance = new CustomClass('test');
    const expected = { customValue: 'test', type: 'custom' };
    assert.deepStrictEqual(serialize(instance), expected);
  });

  t.test('should handle nested Serializable objects', () => {
    class Person implements Serializable {
      constructor(private name: string, private age: number) {}
      
      serialize(): JsonValue {
        return { name: this.name, age: this.age };
      }
    }

    class Team implements Serializable {
      constructor(private name: string, private members: Person[]) {}
      
      serialize(): JsonValue {
        return {
          teamName: this.name,
          members: this.members.map(m => m.serialize())
        };
      }
    }

    const team = new Team('Dev Team', [
      new Person('Alice', 30),
      new Person('Bob', 25)
    ]);

    const expected = {
      teamName: 'Dev Team',
      members: [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ]
    };

    assert.deepStrictEqual(serialize(team), expected);
  });

  t.test('should handle Serializable objects that return complex structures', () => {
    class ComplexClass implements Serializable {
      serialize(): JsonValue {
        return {
          data: [1, 2, 3],
          meta: { created: '2025-01-01T12:00:00.000Z' },
          nested: { value: 'test' }
        };
      }
    }

    const instance = new ComplexClass();
    const expected = {
      data: [1, 2, 3],
      meta: { created: '2025-01-01T12:00:00.000Z' },
      nested: { value: 'test' }
    };

    assert.deepStrictEqual(serialize(instance), expected);
  });

  t.test('should handle empty objects and arrays', () => {
    assert.deepStrictEqual(serialize({}), {});
    assert.deepStrictEqual(serialize([]), []);
  });

  t.test('should only serialize own properties', () => {
    const parent = { parentProp: 'parent' };
    const child = Object.create(parent);
    child.childProp = 'child';

    const result = serialize(child);
    assert.deepStrictEqual(result, { childProp: 'child' });
    assert.strictEqual('parentProp' in result, false);
  });
});
