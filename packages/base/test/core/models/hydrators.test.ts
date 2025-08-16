import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    toUniqueID,
    toDate,
    toNumber,
    toString,
    toBoolean,
} from '../../../src/core/models/hydrators.js';
import { UniqueID } from '../../../src/core/models/uniqueId.js';

describe('Model Hydrators', () => {
    describe('toUniqueID hydrator', () => {
        it('should pass through UniqueID instances unchanged', () => {
            const id = new UniqueID();
            const result = toUniqueID(id);
            assert.strictEqual(result, id);
            assert.ok(result instanceof UniqueID);
        });

        it('should convert valid string to UniqueID', () => {
            const validId = new UniqueID().toString();
            const result = toUniqueID(validId);
            assert.ok(result instanceof UniqueID);
            assert.strictEqual(result.toString(), validId);
        });

        it('should throw for invalid string format', () => {
            assert.throws(() => {
                toUniqueID('invalid-id');
            }, /Invalid UniqueID/);
        });

        it('should throw for non-string, non-UniqueID values', () => {
            assert.throws(() => {
                toUniqueID(123);
            }, /Cannot convert/);

            assert.throws(() => {
                toUniqueID({});
            }, /Cannot convert/);

            assert.throws(() => {
                toUniqueID(null);
            }, /Cannot convert/);
        });
    });

    describe('toDate hydrator', () => {
        it('should pass through Date instances unchanged', () => {
            const date = new Date();
            const result = toDate(date);
            assert.strictEqual(result, date);
        });

        it('should convert valid date strings to Date', () => {
            const dateString = '2023-12-25T10:30:00.000Z';
            const result = toDate(dateString);
            assert.ok(result instanceof Date);
            assert.strictEqual(result.toISOString(), dateString);
        });

        it('should convert timestamps to Date', () => {
            const timestamp = Date.now();
            const result = toDate(timestamp);
            assert.ok(result instanceof Date);
            assert.strictEqual(result.getTime(), timestamp);
        });

        it('should throw for invalid date strings', () => {
            assert.throws(() => {
                toDate('not-a-date');
            }, /Cannot convert/);
        });

        it('should throw for non-convertible values', () => {
            assert.throws(() => {
                toDate({});
            }, /Cannot convert/);

            assert.throws(() => {
                toDate(null);
            }, /Cannot convert/);
        });
    });

    describe('toNumber hydrator', () => {
        it('should pass through numbers unchanged', () => {
            assert.strictEqual(toNumber(42), 42);
            assert.strictEqual(toNumber(3.14), 3.14);
            assert.strictEqual(toNumber(0), 0);
            assert.strictEqual(toNumber(-5), -5);
        });

        it('should convert numeric strings to numbers', () => {
            assert.strictEqual(toNumber('42'), 42);
            assert.strictEqual(toNumber('3.14'), 3.14);
            assert.strictEqual(toNumber('0'), 0);
            assert.strictEqual(toNumber('-5'), -5);
        });

        it('should throw for non-numeric strings', () => {
            assert.throws(() => {
                toNumber('not-a-number');
            }, /Cannot convert/);

            assert.throws(() => {
                toNumber('');
            }, /Cannot convert/);
        });

        it('should throw for non-convertible values', () => {
            assert.throws(() => {
                toNumber({});
            }, /Cannot convert/);

            assert.throws(() => {
                toNumber(null);
            }, /Cannot convert/);
        });
    });

    describe('toString hydrator', () => {
        it('should pass through strings unchanged', () => {
            assert.strictEqual(toString('hello'), 'hello');
            assert.strictEqual(toString(''), '');
        });

        it('should convert numbers to strings', () => {
            assert.strictEqual(toString(42), '42');
            assert.strictEqual(toString(3.14), '3.14');
            assert.strictEqual(toString(0), '0');
        });

        it('should convert booleans to strings', () => {
            assert.strictEqual(toString(true), 'true');
            assert.strictEqual(toString(false), 'false');
        });

        it('should throw for null and undefined', () => {
            assert.throws(() => {
                toString(null);
            }, /Cannot convert/);

            assert.throws(() => {
                toString(undefined);
            }, /Cannot convert/);
        });

        it('should throw for objects', () => {
            assert.throws(() => {
                toString({});
            }, /Cannot convert/);

            assert.throws(() => {
                toString([]);
            }, /Cannot convert/);
        });
    });

    describe('toBoolean hydrator', () => {
        it('should pass through booleans unchanged', () => {
            assert.strictEqual(toBoolean(true), true);
            assert.strictEqual(toBoolean(false), false);
        });

        it('should convert truthy string values to true', () => {
            assert.strictEqual(toBoolean('true'), true);
            assert.strictEqual(toBoolean('TRUE'), true);
            assert.strictEqual(toBoolean('True'), true);
            assert.strictEqual(toBoolean('yes'), true);
            assert.strictEqual(toBoolean('YES'), true);
            assert.strictEqual(toBoolean('1'), true);
            assert.strictEqual(toBoolean('on'), true);
        });

        it('should convert falsy string values to false', () => {
            assert.strictEqual(toBoolean('false'), false);
            assert.strictEqual(toBoolean('FALSE'), false);
            assert.strictEqual(toBoolean('False'), false);
            assert.strictEqual(toBoolean('no'), false);
            assert.strictEqual(toBoolean('NO'), false);
            assert.strictEqual(toBoolean('0'), false);
            assert.strictEqual(toBoolean('off'), false);
            assert.strictEqual(toBoolean(''), false);
        });

        it('should convert numbers to booleans', () => {
            assert.strictEqual(toBoolean(1), true);
            assert.strictEqual(toBoolean(42), true);
            assert.strictEqual(toBoolean(0), false);
            assert.strictEqual(toBoolean(-1), true);
        });

        it('should throw for unrecognized string values', () => {
            assert.throws(() => {
                toBoolean('maybe');
            }, /Cannot convert/);

            assert.throws(() => {
                toBoolean('unknown');
            }, /Cannot convert/);
        });

        it('should throw for non-convertible values', () => {
            assert.throws(() => {
                toBoolean({});
            }, /Cannot convert/);

            assert.throws(() => {
                toBoolean(null);
            }, /Cannot convert/);
        });
    });
});
