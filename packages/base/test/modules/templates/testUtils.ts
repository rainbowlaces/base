import { mock } from 'node:test';
import type { BaseDi } from '../../../src/core/di/baseDi.js';
import { type BaseLogger } from '../../../src/core/logger/baseLogger.js';
import { type TemplateResult } from '../../../src/modules/templates/engine/templateResult.js';

/**
 * Mock BaseDi with in-memory registry for template testing
 */
export function getMockBaseDi(): typeof BaseDi {
  const registry = new Map<string, unknown>();
  const taggedRegistry = new Map<string, unknown[]>();
  
  return {
    register: mock.fn((instance: unknown, options: { key: string; singleton?: boolean; type?: string; tags?: string[] }) => {
      registry.set(options.key, instance);
      
      // Handle tags
      if (options.tags) {
        for (const tag of options.tags) {
          if (!taggedRegistry.has(tag)) {
            taggedRegistry.set(tag, []);
          }
          taggedRegistry.get(tag)!.push(instance);
        }
      }
    }),
    
    resolve: mock.fn(<T>(key: string, ..._args: unknown[]): T => {
      const instance = registry.get(key);
      if (!instance) {
        throw new Error(`No instance registered for key: ${key}`);
      }
      return instance as T;
    }),
    
    resolveByTag: mock.fn(<T>(tag: string): T[] => {
      return (taggedRegistry.get(tag) ?? []) as T[];
    }),
    
    reset: mock.fn(() => {
      registry.clear();
      taggedRegistry.clear();
    }),
    
    isRegistered: mock.fn((key: string): boolean => {
      return registry.has(key);
    }),
    
    unregister: mock.fn((key: string): void => {
      registry.delete(key);
    })
  } as unknown as typeof BaseDi;
}

/**
 * Helper to render TemplateResult to string
 */
export async function renderToString(templateResult: TemplateResult): Promise<string> {
  return await templateResult.render();
}

/**
 * Test fixtures
 */
export const FIXTURES = {
  // Simple list for testing each tags
  simpleList: ['item1', 'item2', 'item3'],
  
  // Boolean flags for testing if tags
  booleanFlags: {
    isTrue: true,
    isFalse: false,
    isUndefined: undefined,
    isNull: null
  },
  
  // User data for testing templates
  userData: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    isAdmin: true,
    preferences: {
      theme: 'dark',
      notifications: false
    }
  },
  
  // HTML content for testing sanitization
  dangerousContent: {
    script: '<script>alert("xss")</script>',
    htmlTags: '<div class="test">Content</div>',
    entities: '&lt;div&gt;Pre-escaped&lt;/div&gt;',
    mixed: 'Safe text <script>danger</script> more text'
  }
};

/**
 * Mock logger for testing
 */
export function getMockLogger(): BaseLogger {
  return {
    error: mock.fn(),
    info: mock.fn(),
    warn: mock.fn(), 
    debug: mock.fn(),
    trace: mock.fn(),
    fatal: mock.fn()
  } as unknown as BaseLogger;
}
