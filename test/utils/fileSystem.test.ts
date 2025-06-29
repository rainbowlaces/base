import { test } from 'node:test';
import * as assert from 'node:assert';
import { NodeFileSystem } from '../../src/utils/fileSystem';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const FILENAME = fileURLToPath(import.meta.url);
const DIRNAME = path.dirname(FILENAME);

test('NodeFileSystem class', (t) => {
  t.test('should implement FileSystem interface correctly', () => {
    const nodeFs = new NodeFileSystem();
    
    // Check that all required methods exist
    assert.strictEqual(typeof nodeFs.readdir, 'function');
    assert.strictEqual(typeof nodeFs.readFile, 'function');
    assert.strictEqual(typeof nodeFs.stat, 'function');
  });

  t.test('should read directory with file types', async () => {
    const nodeFs = new NodeFileSystem();
    const testDir = path.join(DIRNAME, '..');
    
    const entries = await nodeFs.readdir(testDir, { withFileTypes: true });
    
    assert.ok(Array.isArray(entries));
    assert.ok(entries.length > 0);
    
    // Check that entries have required methods
    for (const entry of entries) {
      assert.strictEqual(typeof entry.name, 'string');
      assert.strictEqual(typeof entry.isFile, 'function');
      assert.strictEqual(typeof entry.isDirectory, 'function');
      assert.strictEqual(typeof entry.isFile(), 'boolean');
      assert.strictEqual(typeof entry.isDirectory(), 'boolean');
    }
  });

  t.test('should read this test file', async () => {
    const nodeFs = new NodeFileSystem();
    
    const content = await nodeFs.readFile(FILENAME);
    
    assert.ok(Buffer.isBuffer(content));
    assert.ok(content.length > 0);
    
    // Should contain some test code
    const contentStr = content.toString();
    assert.ok(contentStr.includes('NodeFileSystem'));
    assert.ok(contentStr.includes('should read this test file'));
  });

  t.test('should get file stats', async () => {
    const nodeFs = new NodeFileSystem();
    
    const stats = await nodeFs.stat(FILENAME);
    
    assert.ok(stats);
    assert.strictEqual(typeof stats.size, 'number');
    assert.ok(stats.size > 0);
    assert.ok(stats.isFile());
    assert.strictEqual(stats.isDirectory(), false);
  });

  t.test('should handle nonexistent directory', async () => {
    const nodeFs = new NodeFileSystem();
    const nonexistentDir = '/this/directory/should/not/exist/12345';
    
    await assert.rejects(
      () => nodeFs.readdir(nonexistentDir, { withFileTypes: true }),
      /ENOENT.*no such file or directory/
    );
  });

  t.test('should handle nonexistent file for readFile', async () => {
    const nodeFs = new NodeFileSystem();
    const nonexistentFile = '/this/file/should/not/exist/12345.txt';
    
    await assert.rejects(
      () => nodeFs.readFile(nonexistentFile),
      /ENOENT.*no such file or directory/
    );
  });

  t.test('should handle nonexistent file for stat', async () => {
    const nodeFs = new NodeFileSystem();
    const nonexistentFile = '/this/file/should/not/exist/12345.txt';
    
    await assert.rejects(
      () => nodeFs.stat(nonexistentFile),
      /ENOENT.*no such file or directory/
    );
  });

  t.test('should handle permission errors gracefully', async () => {
    const nodeFs = new NodeFileSystem();
    
    // Try to read a file that might have permission issues
    // This test might not fail on all systems, but it's good to have
    try {
      await nodeFs.readFile('/etc/shadow');
      // If we get here, the system might allow reading this file
      // which is fine for our test purposes
    } catch (error) {
      // Should be permission error or file not found
      assert.ok(error instanceof Error);
      assert.ok(
        error.message.includes('EACCES') || 
        error.message.includes('ENOENT') ||
        error.message.includes('permission denied')
      );
    }
  });
});

test('FileSystem interface compatibility', (t) => {
  t.test('should be compatible with fs.promises API', async () => {
    const nodeFs = new NodeFileSystem();
    
    // Compare with direct fs.promises calls
    const testDir = DIRNAME;
    
    const [fsEntries, nodeEntries] = await Promise.all([
      fs.promises.readdir(testDir, { withFileTypes: true }),
      nodeFs.readdir(testDir, { withFileTypes: true })
    ]);
    
    // Should have same number of entries
    assert.strictEqual(nodeEntries.length, fsEntries.length);
    
    // Should have same entry names
    const fsNames = fsEntries.map(e => e.name).sort();
    const nodeNames = nodeEntries.map(e => e.name).sort();
    assert.deepStrictEqual(nodeNames, fsNames);
    
    // Should have same file/directory types for each entry
    for (let i = 0; i < fsEntries.length; i++) {
      const fsEntry = fsEntries.find(e => e.name === nodeEntries[i].name)!;
      assert.strictEqual(nodeEntries[i].isFile(), fsEntry.isFile());
      assert.strictEqual(nodeEntries[i].isDirectory(), fsEntry.isDirectory());
    }
  });
});
