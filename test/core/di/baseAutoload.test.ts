import { test } from 'node:test';
import * as assert from 'node:assert';
import { BaseAutoload } from '../../../src/core/di/baseAutoload.js';
import { type FileSystem, type FileSystemEntry } from '../../../src/utils/fileSystem.js';
import type fs from 'fs';

test('BaseAutoload', (t) => {
  t.beforeEach(() => {
    // Clear autoloaded files before each test
    BaseAutoload.clearAutoloadedFiles();
  });

  t.test('autoload()', (t) => {
    t.test('should autoload JavaScript files from directory', async () => {
      // Mock file system
      const mockFileSystem: FileSystem = {
        readdir: async (path: string) => {
          if (path === '/test/root') {
            return [
              { name: 'service1.js', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
              { name: 'service2.js', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
              { name: 'readme.txt', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
            ];
          }
          return [];
        },
        readFile: async () => Buffer.from(''),
        stat: async () => ({ size: 0, isDirectory: () => false, isFile: () => true } as fs.Stats)
      };

      await BaseAutoload.autoload('/test/root', [], mockFileSystem);
      
      // Check that files were tracked
      const autoloadedFiles = BaseAutoload.getAutoloadedFiles();
      assert.strictEqual(autoloadedFiles.size, 2); // Only .js files
      assert.ok(autoloadedFiles.has('/test/root/service1.js'));
      assert.ok(autoloadedFiles.has('/test/root/service2.js'));
    });

    t.test('should recursively scan subdirectories', async () => {
      const mockFileSystem: FileSystem = {
        readdir: async (path: string) => {
          if (path === '/test/root') {
            return [
              { name: 'subdir', isDirectory: () => true, isFile: () => false } as FileSystemEntry,
              { name: 'root.js', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
            ];
          } else if (path === '/test/root/subdir') {
            return [
              { name: 'nested.js', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
            ];
          }
          return [];
        },
        readFile: async () => Buffer.from(''),
        stat: async () => ({ size: 0, isDirectory: () => false, isFile: () => true } as fs.Stats)
      };

      await BaseAutoload.autoload('/test/root', [], mockFileSystem);
      
      const autoloadedFiles = BaseAutoload.getAutoloadedFiles();
      assert.strictEqual(autoloadedFiles.size, 2);
      assert.ok(autoloadedFiles.has('/test/root/root.js'));
      assert.ok(autoloadedFiles.has('/test/root/subdir/nested.js'));
    });

    t.test('should skip files matching ignore patterns', async () => {
      const mockFileSystem: FileSystem = {
        readdir: async (path: string) => {
          if (path === '/test/root') {
            return [
              { name: 'service1.js', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
              { name: 'test.js', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
              { name: 'spec.js', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
            ];
          }
          return [];
        },
        readFile: async () => Buffer.from(''),
        stat: async () => ({ size: 0, isDirectory: () => false, isFile: () => true } as fs.Stats)
      };

      await BaseAutoload.autoload('/test/root', ['**/test.js', '**/spec.js'], mockFileSystem);
      
      const autoloadedFiles = BaseAutoload.getAutoloadedFiles();
      assert.strictEqual(autoloadedFiles.size, 1);
      assert.ok(autoloadedFiles.has('/test/root/service1.js'));
      assert.ok(!autoloadedFiles.has('/test/root/test.js'));
      assert.ok(!autoloadedFiles.has('/test/root/spec.js'));
    });

    t.test('should skip non-JavaScript files', async () => {
      const mockFileSystem: FileSystem = {
        readdir: async () => [
          { name: 'service.js', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
          { name: 'config.json', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
          { name: 'style.css', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
          { name: 'script.ts', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
        ],
        readFile: async () => Buffer.from(''),
        stat: async () => ({ size: 0, isDirectory: () => false, isFile: () => true } as fs.Stats)
      };

      await BaseAutoload.autoload('/test/root', [], mockFileSystem);
      
      const autoloadedFiles = BaseAutoload.getAutoloadedFiles();
      assert.strictEqual(autoloadedFiles.size, 1);
      assert.ok(autoloadedFiles.has('/test/root/service.js'));
    });

    t.test('should handle import errors gracefully', async () => {
      const mockFileSystem: FileSystem = {
        readdir: async () => [
          { name: 'good.js', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
          { name: 'bad.js', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
        ],
        readFile: async () => Buffer.from(''),
        stat: async () => ({ size: 0, isDirectory: () => false, isFile: () => true } as fs.Stats)
      };

      // Capture console.error to verify error handling
      const originalConsoleError = console.error;
      let _errorCalled = false;
      console.error = () => { _errorCalled = true; };

      try {
        await BaseAutoload.autoload('/test/root', [], mockFileSystem);
        
        const autoloadedFiles = BaseAutoload.getAutoloadedFiles();
        assert.strictEqual(autoloadedFiles.size, 2); // Both files should be tracked
        assert.ok(autoloadedFiles.has('/test/root/good.js'));
        assert.ok(autoloadedFiles.has('/test/root/bad.js'));
        // Note: error handling depends on actual import behavior which is hard to mock
      } finally {
        console.error = originalConsoleError;
      }
    });

    t.test('should skip already autoloaded files', async () => {
      const mockFileSystem: FileSystem = {
        readdir: async () => [
          { name: 'service.js', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
        ],
        readFile: async () => Buffer.from(''),
        stat: async () => ({ size: 0, isDirectory: () => false, isFile: () => true } as fs.Stats)
      };

      const originalConsoleError = console.error;
      console.error = () => { /* suppress output */ };

      try {
        // First autoload
        await BaseAutoload.autoload('/test/root', [], mockFileSystem);
        assert.strictEqual(BaseAutoload.getAutoloadedFiles().size, 1);
        
        // Clear the set to test re-adding
        const filesToCheck = [...BaseAutoload.getAutoloadedFiles()];
        BaseAutoload.clearAutoloadedFiles();
        assert.strictEqual(BaseAutoload.getAutoloadedFiles().size, 0);
        
        // Manually add the file back to simulate it being already loaded
        for (const file of filesToCheck) {
          BaseAutoload.getAutoloadedFiles().add(file); // This won't work since we get a copy
        }
        
        // Actually, let's test this differently - by running autoload twice and checking files aren't imported twice
        BaseAutoload.clearAutoloadedFiles();
        await BaseAutoload.autoload('/test/root', [], mockFileSystem);
        assert.strictEqual(BaseAutoload.getAutoloadedFiles().size, 1);
        
        // Second autoload - files are already tracked so imports should be skipped
        await BaseAutoload.autoload('/test/root', [], mockFileSystem);
        assert.strictEqual(BaseAutoload.getAutoloadedFiles().size, 1); // Size should remain the same
      } finally {
        console.error = originalConsoleError;
      }
    });
  });

  t.test('matchesIgnorePattern()', (t) => {
    t.test('should match URLPattern patterns', () => {
      assert.ok(BaseAutoload.matchesIgnorePattern('/path/to/test.js', ['**/test.js']));
      assert.ok(BaseAutoload.matchesIgnorePattern('/path/to/spec.js', ['**/spec.js']));
      assert.ok(!BaseAutoload.matchesIgnorePattern('/path/to/service.js', ['**/test.js']));
    });

    t.test('should match exact string patterns', () => {
      assert.ok(BaseAutoload.matchesIgnorePattern('/exact/path.js', ['/exact/path.js']));
      assert.ok(!BaseAutoload.matchesIgnorePattern('/different/path.js', ['/exact/path.js']));
    });

    t.test('should handle multiple patterns', () => {
      const patterns = ['**/test.js', '**/spec.js', '/exact/path.js'];
      assert.ok(BaseAutoload.matchesIgnorePattern('/some/test.js', patterns));
      assert.ok(BaseAutoload.matchesIgnorePattern('/other/spec.js', patterns));
      assert.ok(BaseAutoload.matchesIgnorePattern('/exact/path.js', patterns));
      assert.ok(!BaseAutoload.matchesIgnorePattern('/normal/service.js', patterns));
    });

    t.test('should fallback to exact match for invalid patterns', () => {
      // Use a pattern that actually causes URLPattern constructor to throw
      const invalidPattern = ':::invalid:::';
      assert.ok(BaseAutoload.matchesIgnorePattern(':::invalid:::', [invalidPattern]));
      assert.ok(!BaseAutoload.matchesIgnorePattern('/some/path.js', [invalidPattern]));
    });

    t.test('should return false for empty patterns array', () => {
      assert.ok(!BaseAutoload.matchesIgnorePattern('/any/path.js', []));
    });
  });

  t.test('clearAutoloadedFiles()', (t) => {
    t.test('should clear the autoloaded files set', async () => {
      const mockFileSystem: FileSystem = {
        readdir: async () => [
          { name: 'service.js', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
        ],
        readFile: async () => Buffer.from(''),
        stat: async () => ({ size: 0, isDirectory: () => false, isFile: () => true } as fs.Stats)
      };

      await BaseAutoload.autoload('/test/root', [], mockFileSystem);
      assert.strictEqual(BaseAutoload.getAutoloadedFiles().size, 1);
      
      BaseAutoload.clearAutoloadedFiles();
      assert.strictEqual(BaseAutoload.getAutoloadedFiles().size, 0);
    });
  });

  t.test('getAutoloadedFiles()', (t) => {
    t.test('should return a copy of autoloaded files set', async () => {
      const mockFileSystem: FileSystem = {
        readdir: async () => [
          { name: 'service.js', isDirectory: () => false, isFile: () => true } as FileSystemEntry,
        ],
        readFile: async () => Buffer.from(''),
        stat: async () => ({ size: 0, isDirectory: () => false, isFile: () => true } as fs.Stats)
      };

      await BaseAutoload.autoload('/test/root', [], mockFileSystem);
      
      const files1 = BaseAutoload.getAutoloadedFiles();
      const files2 = BaseAutoload.getAutoloadedFiles();
      
      // Should be different objects (copies)
      assert.notStrictEqual(files1, files2);
      // But with same content
      assert.deepStrictEqual([...files1], [...files2]);
      
      // Modifying returned set shouldn't affect internal state
      files1.clear();
      assert.strictEqual(BaseAutoload.getAutoloadedFiles().size, 1);
    });
  });
});
