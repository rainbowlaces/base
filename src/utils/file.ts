import path from "path";
import type fs from "fs";
import { fileURLToPath } from "url";
import { type FileSystem, NodeFileSystem } from "./fileSystem.js";

export function getFilename(metaUrl: string): string {
  return path.resolve(fileURLToPath(metaUrl));
}

export function getDirname(metaUrl: string): string {
  const filepath = getFilename(metaUrl);
  return path.dirname(filepath);
}
export async function findFileUp(
  startingDirectory: string,
  pattern: RegExp | string,
  fileSystem: FileSystem = new NodeFileSystem(),
): Promise<string | null> {
  const files = await fileSystem.readdir(startingDirectory, {
    withFileTypes: true,
  });
  for (const file of files) {
    if (file.isFile()) {
      if (pattern instanceof RegExp && pattern.test(file.name)) {
        return path.join(startingDirectory, file.name);
      }
      if (typeof pattern === "string" && file.name === pattern) {
        return path.join(startingDirectory, file.name);
      }
    }
  }
  const parentDirectory = path.dirname(startingDirectory);
  if (parentDirectory === startingDirectory) {
    return null;
  }
  return await findFileUp(parentDirectory, pattern, fileSystem);
}

export async function loadFile(
  file: string,
  fileSystem: FileSystem = new NodeFileSystem(),
): Promise<{ data: Buffer; stats: fs.Stats }> {
  const [data, stats] = await Promise.all([
    fileSystem.readFile(file),
    fileSystem.stat(file),
  ]);
  return { data, stats };
}
