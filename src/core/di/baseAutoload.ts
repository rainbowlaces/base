import { type FileSystem, NodeFileSystem } from "../../utils/fileSystem";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BaseAutoload {
  private static autoloadedFiles = new Set<string>();

  static async autoload(
    root: string,
    ignore: string[] = [],
    fileSystem: FileSystem = new NodeFileSystem()
  ): Promise<void> {
    if (BaseAutoload.matchesIgnorePattern(root, ignore)) {
      return;
    }
    console.log(`${root}:`);
    const path = await import("path");
    const files = await fileSystem.readdir(root, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(root, file.name);
      if (file.isDirectory()) {
        await BaseAutoload.autoload(filePath, ignore, fileSystem);
      } else if (file.isFile() && file.name.endsWith(".js")) {
        if (BaseAutoload.matchesIgnorePattern(filePath, ignore)) {
          continue;
        }

        // Skip if already imported
        if (BaseAutoload.autoloadedFiles.has(filePath)) {
          continue;
        }

        try {
          await import(filePath);
          BaseAutoload.autoloadedFiles.add(filePath);
          console.log(` - ${path.basename(filePath)}`);
        } catch (err) {
          console.error(` - FAILED: ${path.basename(filePath)}`, err);
          BaseAutoload.autoloadedFiles.add(filePath);
        }
      }
    }
  }

  static matchesIgnorePattern(filename: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      try {
        const urlPattern = new URLPattern({ pathname: pattern });
        // URLPattern.test() expects a full URL or URL components object
        // For file paths, we need to test against the pathname component
        return urlPattern.test({ pathname: filename });
      } catch {
        // Fallback to exact string match if pattern is invalid
        return filename === pattern;
      }
    });
  }

  static clearAutoloadedFiles(): void {
    BaseAutoload.autoloadedFiles.clear();
  }

  static getAutoloadedFiles(): Set<string> {
    return new Set(BaseAutoload.autoloadedFiles);
  }
}
