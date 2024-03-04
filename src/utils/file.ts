import path from "path";
import { fileURLToPath } from "url";

export function getFilename(metaUrl: string): string {
  return path.resolve(fileURLToPath(metaUrl));
}

export function getDirname(metaUrl: string): string {
  const filepath = getFilename(metaUrl);
  return path.dirname(filepath);
}
