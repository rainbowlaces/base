import { type FileSystem, NodeFileSystem } from "../../utils/fileSystem.js";
import { debugLog } from "../../utils/debugLog.js";

 
export class BaseAutoload {
  private static autoloadedFiles = new Set<string>();

  static async autoload(
    root: string,
    ignore: string[] = [],
    fileSystem: FileSystem = new NodeFileSystem()
  ): Promise<void> {
    console.log(`[BaseAutoload] Starting autoload for root: ${root}`);
    debugLog(`[BaseAutoload] Ignore patterns:`, ignore);
    
    if (BaseAutoload.matchesIgnorePattern(root, ignore)) {
      debugLog(`[BaseAutoload] Root path ${root} matches ignore pattern, skipping`);
      return;
    }
    
    const path = await import("path");
    debugLog(`[BaseAutoload] Reading directory: ${root}`);
    const files = await fileSystem.readdir(root, { withFileTypes: true });
    debugLog(`[BaseAutoload] Found ${files.length} items in ${root}`);
    
    for (const file of files) {
      const filePath = path.join(root, file.name);
      debugLog(`[BaseAutoload] Processing item: ${filePath} (${file.isDirectory() ? 'directory' : 'file'})`);
      
      if (file.isDirectory()) {
        debugLog(`[BaseAutoload] Recursing into directory: ${filePath}`);
        await BaseAutoload.autoload(filePath, ignore, fileSystem);
      } else if (file.isFile() && file.name.endsWith(".js")) {
        debugLog(`[BaseAutoload] Found JS file: ${filePath}`);
        
        if (BaseAutoload.matchesIgnorePattern(filePath, ignore)) {
          debugLog(`[BaseAutoload] File ${filePath} matches ignore pattern, skipping`);
          continue;
        }

        // Skip if already imported
        if (BaseAutoload.autoloadedFiles.has(filePath)) {
          debugLog(`[BaseAutoload] File ${filePath} already imported, skipping`);
          continue;
        }

        try {
          debugLog(`[BaseAutoload] Importing file: ${filePath}`);
          await import(filePath);
          BaseAutoload.autoloadedFiles.add(filePath);
          debugLog(`[BaseAutoload] ✅ Successfully imported: ${path.basename(filePath)}`);
        } catch (err) {
          console.error(`FAILED AUTOLOAD: ${path.basename(filePath)}`, err);
          BaseAutoload.autoloadedFiles.add(filePath);
          debugLog(`[BaseAutoload] ❌ Failed to import ${path.basename(filePath)}, added to autoloaded files to prevent retry`);
        }
      } else {
        debugLog(`[BaseAutoload] Skipping non-JS file: ${filePath}`);
      }
    }
    
    debugLog(`[BaseAutoload] Completed autoload for root: ${root}`);
  }

  static matchesIgnorePattern(filename: string, patterns: string[]): boolean {
    debugLog(`[BaseAutoload] Checking if ${filename} matches ignore patterns:`, patterns);
    
    const matches = patterns.some((pattern) => {
      try {
        const urlPattern = new URLPattern({ pathname: pattern });
        const isMatch = urlPattern.test({ pathname: filename });
        debugLog(`[BaseAutoload] Pattern '${pattern}' ${isMatch ? 'matches' : 'does not match'} '${filename}'`);
        return isMatch;
      } catch {
        const isMatch = filename === pattern;
        debugLog(`[BaseAutoload] Pattern '${pattern}' (exact match) ${isMatch ? 'matches' : 'does not match'} '${filename}'`);
        return isMatch;
      }
    });
    
    debugLog(`[BaseAutoload] Final result: ${filename} ${matches ? 'matches' : 'does not match'} ignore patterns`);
    return matches;
  }

  static clearAutoloadedFiles(): void {
    debugLog(`[BaseAutoload] Clearing ${BaseAutoload.autoloadedFiles.size} autoloaded files`);
    BaseAutoload.autoloadedFiles.clear();
    debugLog(`[BaseAutoload] Autoloaded files cleared`);
  }

  static getAutoloadedFiles(): Set<string> {
    debugLog(`[BaseAutoload] Getting autoloaded files (${BaseAutoload.autoloadedFiles.size} files)`);
    return new Set(BaseAutoload.autoloadedFiles);
  }
}
