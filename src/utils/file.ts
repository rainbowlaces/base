import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

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
): Promise<string | null> {
  const files = await fs.promises.readdir(startingDirectory, {
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
    // Root of the filesystem reached without finding a match
    return null;
  }
  // Recurse into the parent directory
  return await findFileUp(parentDirectory, pattern);
}

export async function loadFile(
  file: string,
): Promise<{ data: Buffer; stats: fs.Stats }> {
  const [data, stats] = await Promise.all([
    fs.promises.readFile(file),
    fs.promises.stat(file),
  ]);
  return { data, stats };
}
