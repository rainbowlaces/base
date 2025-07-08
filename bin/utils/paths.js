import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Get the framework root directory (the directory containing the base framework)
 * This is one level up from the cli.js location
 */
export function getFrameworkRoot() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(__dirname, '../../'); // bin/utils -> bin -> root
}

/**
 * Find the project root by walking up the directory tree looking for package.json
 * @param {string} startPath - Starting directory (defaults to process.cwd())
 * @returns {string} Path to the project root
 * @throws {Error} If no package.json is found
 */
export function findProjectRoot(startPath = process.cwd()) {
  let currentPath = path.resolve(startPath);
  
  while (currentPath !== path.parse(currentPath).root) {
    const packageJsonPath = path.join(currentPath, 'package.json');
    
    try {
      if (fs.existsSync(packageJsonPath)) {
        return currentPath;
      }
    } catch (_err) {
      // Continue searching if we can't read this directory
    }
    
    currentPath = path.dirname(currentPath);
  }
  
  throw new Error(`No package.json found in directory tree starting from: ${startPath}`);
}

/**
 * Get both framework and project root paths
 * @param {string} startPath - Starting directory for project search (defaults to process.cwd())
 * @returns {object} Object containing frameworkRoot and projectRoot paths
 */
export function resolvePaths(startPath = process.cwd()) {
  return {
    frameworkRoot: getFrameworkRoot(),
    projectRoot: findProjectRoot(startPath)
  };
}
