import { test } from 'node:test';
import * as assert from 'node:assert';
import {
  kebabToUpperCamel,
  kebabToLowerCamel,
  camelToKebab,
  camelToLowerUnderscore,
  camelToUpperUnderscore,
  isUpperCamelCase,
  isLowerCamelCase,
  isLowerUnderscore,
  isUpperUnderscore,
  isKebabCase,
  stringToSlug,
  truncate
} from '../../src/utils/string';

test('kebabToUpperCamel function', (t) => {
  t.test('should convert multi-word kebab-case to UpperCamelCase', () => {
    const input = 'a-very-long-string';
    const expected = 'AVeryLongString';
    assert.strictEqual(kebabToUpperCamel(input), expected);
  });

  t.test('should handle single words', () => {
    assert.strictEqual(kebabToUpperCamel('word'), 'Word');
  });

  t.test('should return an empty string if given an empty string', () => {
    assert.strictEqual(kebabToUpperCamel(''), '');
  });

  t.test('should handle underscores and spaces as separators', () => {
    assert.strictEqual(kebabToUpperCamel('test_with_underscores'), 'TestWithUnderscores');
    assert.strictEqual(kebabToUpperCamel('test with spaces'), 'TestWithSpaces');
  });

  t.test('should handle mixed separators', () => {
    assert.strictEqual(kebabToUpperCamel('test-with_mixed separators'), 'TestWithMixedSeparators');
  });

  t.test('should handle numbers', () => {
    assert.strictEqual(kebabToUpperCamel('test-123-number'), 'Test123Number');
  });
});

test('kebabToLowerCamel function', (t) => {
  t.test('should convert kebab-case to lowerCamelCase', () => {
    assert.strictEqual(kebabToLowerCamel('a-very-long-string'), 'aVeryLongString');
  });

  t.test('should handle single words', () => {
    assert.strictEqual(kebabToLowerCamel('word'), 'word');
  });

  t.test('should return an empty string if given an empty string', () => {
    assert.strictEqual(kebabToLowerCamel(''), '');
  });

  t.test('should handle underscores and spaces', () => {
    assert.strictEqual(kebabToLowerCamel('test_with_underscores'), 'testWithUnderscores');
    assert.strictEqual(kebabToLowerCamel('test with spaces'), 'testWithSpaces');
  });
});

test('camelToKebab function', (t) => {
  t.test('should convert UpperCamelCase to kebab-case', () => {
    assert.strictEqual(camelToKebab('AVeryLongString'), 'a-very-long-string');
  });

  t.test('should convert lowerCamelCase to kebab-case', () => {
    assert.strictEqual(camelToKebab('aVeryLongString'), 'a-very-long-string');
  });

  t.test('should handle single words', () => {
    assert.strictEqual(camelToKebab('Word'), 'word');
    assert.strictEqual(camelToKebab('word'), 'word');
  });

  t.test('should return an empty string if given an empty string', () => {
    assert.strictEqual(camelToKebab(''), '');
  });

  t.test('should handle numbers', () => {
    assert.strictEqual(camelToKebab('Test123Number'), 'test123-number');
  });
});

test('camelToLowerUnderscore function', (t) => {
  t.test('should convert camelCase to lower_underscore', () => {
    assert.strictEqual(camelToLowerUnderscore('aVeryLongString'), 'a_very_long_string');
    assert.strictEqual(camelToLowerUnderscore('AVeryLongString'), 'avery_long_string');
  });

  t.test('should handle single words', () => {
    assert.strictEqual(camelToLowerUnderscore('Word'), 'word');
    assert.strictEqual(camelToLowerUnderscore('word'), 'word');
  });

  t.test('should return an empty string if given an empty string', () => {
    assert.strictEqual(camelToLowerUnderscore(''), '');
  });
});

test('camelToUpperUnderscore function', (t) => {
  t.test('should convert camelCase to UPPER_UNDERSCORE', () => {
    assert.strictEqual(camelToUpperUnderscore('aVeryLongString'), 'A_VERY_LONG_STRING');
    assert.strictEqual(camelToUpperUnderscore('AVeryLongString'), 'AVERY_LONG_STRING');
  });

  t.test('should handle single words', () => {
    assert.strictEqual(camelToUpperUnderscore('Word'), 'WORD');
    assert.strictEqual(camelToUpperUnderscore('word'), 'WORD');
  });

  t.test('should return an empty string if given an empty string', () => {
    assert.strictEqual(camelToUpperUnderscore(''), '');
  });
});

test('isUpperCamelCase function', (t) => {
  t.test('should return true for valid UpperCamelCase', () => {
    assert.strictEqual(isUpperCamelCase('Test'), true);
    assert.strictEqual(isUpperCamelCase('TestString'), true);
    assert.strictEqual(isUpperCamelCase('AVeryLongString'), true);
    assert.strictEqual(isUpperCamelCase('Test123'), true);
  });

  t.test('should return false for invalid UpperCamelCase', () => {
    assert.strictEqual(isUpperCamelCase('test'), false);
    assert.strictEqual(isUpperCamelCase('testString'), false);
    assert.strictEqual(isUpperCamelCase('test-string'), false);
    assert.strictEqual(isUpperCamelCase('test_string'), false);
    assert.strictEqual(isUpperCamelCase('Test String'), false);
    assert.strictEqual(isUpperCamelCase(''), false);
    assert.strictEqual(isUpperCamelCase('123Test'), false);
  });
});

test('isLowerCamelCase function', (t) => {
  t.test('should return true for valid lowerCamelCase', () => {
    assert.strictEqual(isLowerCamelCase('test'), true);
    assert.strictEqual(isLowerCamelCase('testString'), true);
    assert.strictEqual(isLowerCamelCase('aVeryLongString'), true);
    assert.strictEqual(isLowerCamelCase('test123'), true);
  });

  t.test('should return false for invalid lowerCamelCase', () => {
    assert.strictEqual(isLowerCamelCase('Test'), false);
    assert.strictEqual(isLowerCamelCase('TestString'), false);
    assert.strictEqual(isLowerCamelCase('test-string'), false);
    assert.strictEqual(isLowerCamelCase('test_string'), false);
    assert.strictEqual(isLowerCamelCase('test string'), false);
    assert.strictEqual(isLowerCamelCase(''), false);
    assert.strictEqual(isLowerCamelCase('123test'), false);
  });
});

test('isLowerUnderscore function', (t) => {
  t.test('should return true for valid lower_underscore', () => {
    assert.strictEqual(isLowerUnderscore('test'), true);
    assert.strictEqual(isLowerUnderscore('test_string'), true);
    assert.strictEqual(isLowerUnderscore('a_very_long_string'), true);
    assert.strictEqual(isLowerUnderscore('test123'), true);
    assert.strictEqual(isLowerUnderscore('test_123'), true);
  });

  t.test('should return false for invalid lower_underscore', () => {
    assert.strictEqual(isLowerUnderscore('Test'), false);
    assert.strictEqual(isLowerUnderscore('TEST_STRING'), false);
    assert.strictEqual(isLowerUnderscore('test-string'), false);
    assert.strictEqual(isLowerUnderscore('testString'), false);
    assert.strictEqual(isLowerUnderscore('test string'), false);
    assert.strictEqual(isLowerUnderscore(''), false);
    assert.strictEqual(isLowerUnderscore('123test'), false);
  });
});

test('isUpperUnderscore function', (t) => {
  t.test('should return true for valid UPPER_UNDERSCORE', () => {
    assert.strictEqual(isUpperUnderscore('TEST'), true);
    assert.strictEqual(isUpperUnderscore('TEST_STRING'), true);
    assert.strictEqual(isUpperUnderscore('A_VERY_LONG_STRING'), true);
    assert.strictEqual(isUpperUnderscore('TEST123'), true);
    assert.strictEqual(isUpperUnderscore('TEST_123'), true);
  });

  t.test('should return false for invalid UPPER_UNDERSCORE', () => {
    assert.strictEqual(isUpperUnderscore('test'), false);
    assert.strictEqual(isUpperUnderscore('test_string'), false);
    assert.strictEqual(isUpperUnderscore('Test'), false);
    assert.strictEqual(isUpperUnderscore('TEST-STRING'), false);
    assert.strictEqual(isUpperUnderscore('TestString'), false);
    assert.strictEqual(isUpperUnderscore('TEST STRING'), false);
    assert.strictEqual(isUpperUnderscore(''), false);
    assert.strictEqual(isUpperUnderscore('123TEST'), false);
  });
});

test('isKebabCase function', (t) => {
  t.test('should return true for valid kebab-case', () => {
    assert.strictEqual(isKebabCase('test'), true);
    assert.strictEqual(isKebabCase('test-string'), true);
    assert.strictEqual(isKebabCase('a-very-long-string'), true);
    assert.strictEqual(isKebabCase('test123'), true);
    assert.strictEqual(isKebabCase('test-123'), true);
  });

  t.test('should return false for invalid kebab-case', () => {
    assert.strictEqual(isKebabCase('Test'), false);
    assert.strictEqual(isKebabCase('TEST-STRING'), false);
    assert.strictEqual(isKebabCase('test_string'), false);
    assert.strictEqual(isKebabCase('testString'), false);
    assert.strictEqual(isKebabCase('test string'), false);
    assert.strictEqual(isKebabCase(''), false);
    assert.strictEqual(isKebabCase('123test'), false);
  });
});

test('stringToSlug function', (t) => {
  t.test('should convert regular strings to slugs', () => {
    assert.strictEqual(stringToSlug('Hello World'), 'hello-world');
    assert.strictEqual(stringToSlug('This is a Test'), 'this-is-a-test');
  });

  t.test('should remove special characters', () => {
    assert.strictEqual(stringToSlug('Hello! World@#$'), 'hello-world');
    assert.strictEqual(stringToSlug('Test & Example'), 'test-example');
  });

  t.test('should handle multiple spaces', () => {
    assert.strictEqual(stringToSlug('Hello    World'), 'hello-world');
    assert.strictEqual(stringToSlug('  Test  String  '), 'test-string');
  });

  t.test('should handle empty strings', () => {
    assert.strictEqual(stringToSlug(''), '');
  });

  t.test('should handle numbers', () => {
    assert.strictEqual(stringToSlug('Test 123 String'), 'test-123-string');
  });

  t.test('should handle strings with only special characters', () => {
    assert.strictEqual(stringToSlug('!@#$%^&*()'), '');
  });
});

test('truncate function', (t) => {
  t.test('should truncate strings longer than specified length', () => {
    const input = 'This is a very long string that needs truncating';
    const result = truncate(input, 20);
    assert.strictEqual(result, 'This is a[TRUNCATED]');
  });

  t.test('should not truncate strings shorter than specified length', () => {
    const input = 'Short string';
    const result = truncate(input, 20);
    assert.strictEqual(result, 'Short string');
  });

  t.test('should handle custom append text', () => {
    const input = 'This is a very long string';
    const result = truncate(input, 15, '...');
    assert.strictEqual(result, 'This is a ve...');
  });

  t.test('should handle empty strings', () => {
    assert.strictEqual(truncate('', 10), '');
  });

  t.test('should handle null/undefined input', () => {
    // @ts-expect-error Testing invalid input types
    assert.strictEqual(truncate(null, 10), '');
    // @ts-expect-error Testing invalid input types
    assert.strictEqual(truncate(undefined, 10), '');
  });

  t.test('should handle case where append text is longer than max length', () => {
    const input = 'This is a test';
    const result = truncate(input, 5, '[VERY LONG TRUNCATED MESSAGE]');
    assert.strictEqual(result, 'This ');
  });

  t.test('should handle exact length match', () => {
    const input = 'Exactly20Characters!';
    const result = truncate(input, 20);
    assert.strictEqual(result, 'Exactly20Characters!');
  });
});
