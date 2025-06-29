import { test } from 'node:test';
import * as assert from 'node:assert';
import type fs from 'fs';
import { getFilename, getDirname, findFileUp, loadFile } from '../../src/utils/file';
import type { FileSystem, FileSystemEntry } from '../../src/utils/fileSystem';

// Mock FileSystem for testing
class MockFileSystem implements FileSystem {
  private files = new Map<string, { content: Buffer; stats: fs.Stats; isFile: boolean }>();
  private directories = new Map<string, string[]>();

  setFile(path: string, content: string | Buffer, stats?: Partial<fs.Stats>) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const mockStats = {
      size: buffer.length,
      isFile: () => true,
      isDirectory: () => false,
      mtime: new Date(),
      ctime: new Date(),
      atime: new Date(),
      ...stats
    } as fs.Stats;
    
    this.files.set(path, { content: buffer, stats: mockStats, isFile: true });
    
    // Add to parent directory
    const dir = path.substring(0, path.lastIndexOf('/'));
    const filename = path.substring(path.lastIndexOf('/') + 1);
    if (!this.directories.has(dir)) {
      this.directories.set(dir, []);
    }
    if (!this.directories.get(dir)!.includes(filename)) {
      this.directories.get(dir)!.push(filename);
    }
  }

  setDirectory(path: string, contents: string[] = []) {
    this.directories.set(path, contents);
  }

  async readdir(path: string, _options: { withFileTypes: true }): Promise<FileSystemEntry[]> {
    const contents = this.directories.get(path);
    if (!contents) {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    }

    return contents.map(name => ({
      name,
      isFile: () => this.files.has(`${path}/${name}`),
      isDirectory: () => this.directories.has(`${path}/${name}`)
    }));
  }

  async readFile(path: string): Promise<Buffer> {
    const file = this.files.get(path);
    if (!file) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return file.content;
  }

  async stat(path: string): Promise<fs.Stats> {
    const file = this.files.get(path);
    if (!file) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
    return file.stats;
  }
}

test('getFilename function', (t) => {
  t.test('should convert file URL to absolute path', () => {
    const fileUrl = 'file:///Users/test/project/src/index.js';
    const result = getFilename(fileUrl);
    assert.strictEqual(result, '/Users/test/project/src/index.js');
  });

  t.test('should handle Windows file URLs', () => {
    const fileUrl = 'file:///C:/Users/test/project/src/index.js';
    const result = getFilename(fileUrl);
    // On non-Windows systems, this will still work but path format may differ
    assert.ok(result.includes('index.js'));
  });

  t.test('should resolve relative paths', () => {
    const fileUrl = 'file:///Users/test/project/../project/src/index.js';
    const result = getFilename(fileUrl);
    assert.strictEqual(result, '/Users/test/project/src/index.js');
  });
});

test('getDirname function', (t) => {
  t.test('should get directory from file URL', () => {
    const fileUrl = 'file:///Users/test/project/src/index.js';
    const result = getDirname(fileUrl);
    assert.strictEqual(result, '/Users/test/project/src');
  });

  t.test('should handle root directory', () => {
    const fileUrl = 'file:///index.js';
    const result = getDirname(fileUrl);
    assert.strictEqual(result, '/');
  });

  t.test('should resolve relative paths in directory', () => {
    const fileUrl = 'file:///Users/test/project/../project/src/index.js';
    const result = getDirname(fileUrl);
    assert.strictEqual(result, '/Users/test/project/src');
  });
});

test('findFileUp function', (t) => {
  t.test('should find file by exact name match', async () => {
    const mockFs = new MockFileSystem();
    mockFs.setDirectory('/project/src', ['index.js', 'config.json']);
    mockFs.setFile('/project/src/index.js', 'console.log("hello");');
    mockFs.setFile('/project/src/config.json', '{"name": "test"}');

    const result = await findFileUp('/project/src', 'config.json', mockFs);
    assert.strictEqual(result, '/project/src/config.json');
  });

  t.test('should find file by regex pattern', async () => {
    const mockFs = new MockFileSystem();
    mockFs.setDirectory('/project/src', ['index.js', 'test.spec.js', 'config.json']);
    mockFs.setFile('/project/src/test.spec.js', 'test content');

    const result = await findFileUp('/project/src', /\.spec\.js$/, mockFs);
    assert.strictEqual(result, '/project/src/test.spec.js');
  });

  t.test('should search recursively up the directory tree', async () => {
    const mockFs = new MockFileSystem();
    mockFs.setDirectory('/project', ['package.json']);
    mockFs.setDirectory('/project/src', ['index.js']);
    mockFs.setDirectory('/project/src/components', ['button.js']);
    mockFs.setDirectory('/', []); // Set up root directory
    mockFs.setFile('/project/package.json', '{"name": "test"}');

    const result = await findFileUp('/project/src/components', 'package.json', mockFs);
    assert.strictEqual(result, '/project/package.json');
  });

  t.test('should return null when file not found', async () => {
    const mockFs = new MockFileSystem();
    mockFs.setDirectory('/project', ['index.js']);
    mockFs.setDirectory('/', []); // Set up root directory to prevent errors

    const result = await findFileUp('/project', 'nonexistent.txt', mockFs);
    assert.strictEqual(result, null);
  });

  t.test('should return null when reaching root directory', async () => {
    const mockFs = new MockFileSystem();
    mockFs.setDirectory('/', ['bin', 'usr', 'var']);

    const result = await findFileUp('/', 'nonexistent.txt', mockFs);
    assert.strictEqual(result, null);
  });

  t.test('should handle directory with no files', async () => {
    const mockFs = new MockFileSystem();
    mockFs.setDirectory('/empty', []);
    mockFs.setDirectory('/', []);

    const result = await findFileUp('/empty', 'any.txt', mockFs);
    assert.strictEqual(result, null);
  });

  t.test('should prioritize first match with regex', async () => {
    const mockFs = new MockFileSystem();
    mockFs.setDirectory('/project', ['test1.js', 'test2.js', 'other.txt']);
    mockFs.setFile('/project/test1.js', 'first test');
    mockFs.setFile('/project/test2.js', 'second test');

    const result = await findFileUp('/project', /test\d+\.js/, mockFs);
    // Should return the first match found
    assert.ok(result === '/project/test1.js' || result === '/project/test2.js');
  });
});

test('loadFile function', (t) => {
  t.test('should load file content and stats', async () => {
    const mockFs = new MockFileSystem();
    const content = 'Hello, world!';
    const mockStats = { size: content.length, mtime: new Date('2023-01-01') };
    mockFs.setFile('/test/file.txt', content, mockStats);

    const result = await loadFile('/test/file.txt', mockFs);
    
    assert.ok(Buffer.isBuffer(result.data));
    assert.strictEqual(result.data.toString(), content);
    assert.strictEqual(result.stats.size, content.length);
    assert.ok(result.stats.mtime instanceof Date);
  });

  t.test('should handle binary files', async () => {
    const mockFs = new MockFileSystem();
    const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
    mockFs.setFile('/test/image.png', binaryData);

    const result = await loadFile('/test/image.png', mockFs);
    
    assert.ok(Buffer.isBuffer(result.data));
    assert.strictEqual(result.data.length, 4);
    assert.strictEqual(result.data[0], 0x89);
  });

  t.test('should throw error for nonexistent file', async () => {
    const mockFs = new MockFileSystem();

    await assert.rejects(
      () => loadFile('/nonexistent/file.txt', mockFs),
      /ENOENT: no such file or directory/
    );
  });

  t.test('should handle empty files', async () => {
    const mockFs = new MockFileSystem();
    mockFs.setFile('/test/empty.txt', '');

    const result = await loadFile('/test/empty.txt', mockFs);
    
    assert.strictEqual(result.data.length, 0);
    assert.strictEqual(result.stats.size, 0);
  });

  t.test('should load large files', async () => {
    const mockFs = new MockFileSystem();
    const largeContent = 'A'.repeat(10000);
    mockFs.setFile('/test/large.txt', largeContent);

    const result = await loadFile('/test/large.txt', mockFs);
    
    assert.strictEqual(result.data.toString(), largeContent);
    assert.strictEqual(result.stats.size, 10000);
  });
});

test('file utils integration', (t) => {
  t.test('should work together for common workflow', async () => {
    const mockFs = new MockFileSystem();
    
    // Set up a project structure
    mockFs.setDirectory('/Users/dev/project', ['package.json']);
    mockFs.setDirectory('/Users/dev/project/src', ['index.js']);
    mockFs.setDirectory('/Users/dev', []); // Parent directory
    mockFs.setDirectory('/Users', []); // Grandparent directory
    mockFs.setDirectory('/', []); // Root directory
    mockFs.setFile('/Users/dev/project/package.json', '{"name": "my-project"}');
    
    // Find package.json from nested directory
    const packagePath = await findFileUp('/Users/dev/project/src', 'package.json', mockFs);
    assert.strictEqual(packagePath, '/Users/dev/project/package.json');
    
    // Load the package.json
    const packageFile = await loadFile(packagePath, mockFs);
    const packageData = JSON.parse(packageFile.data.toString());
    assert.strictEqual(packageData.name, 'my-project');
  });
});
