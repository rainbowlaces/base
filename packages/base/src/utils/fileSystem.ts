import fs from "fs";

export interface FileSystemEntry {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
}

export interface FileSystem {
  readdir(path: string, options: { withFileTypes: true }): Promise<FileSystemEntry[]>;
  readFile(path: string): Promise<Buffer>;
  stat(path: string): Promise<fs.Stats>;
  exists(path: string): Promise<boolean>;
  openStatRead(path: string): Promise<{ stats: fs.Stats; data: Buffer }>;
  realpath(path: string): Promise<string>;
}

export class NodeFileSystem implements FileSystem {
  async readdir(path: string, options: { withFileTypes: true }): Promise<FileSystemEntry[]> {
    return fs.promises.readdir(path, options);
  }

  async readFile(path: string): Promise<Buffer> {
    return fs.promises.readFile(path);
  }

  async stat(path: string): Promise<fs.Stats> {
    return fs.promises.stat(path);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.promises.access(path, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async openStatRead(path: string): Promise<{ stats: fs.Stats; data: Buffer }> {
    const handle = await fs.promises.open(path, 'r');
    try {
      const stats = await handle.stat();
      const data = await handle.readFile();
      return { stats, data };
    } finally {
      await handle.close();
    }
  }

  async realpath(path: string): Promise<string> {
    return fs.promises.realpath(path);
  }
}
