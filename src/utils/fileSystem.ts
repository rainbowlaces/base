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
}
