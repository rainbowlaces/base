/**
 * Utility for handling quiet mode flags
 */

/**
 * Get the quiet level from process arguments
 * @returns {number} 0 = normal, 1 = quiet (-q), 2 = errors only (-e), 3 = silent (-s)
 */
export function getQuietLevel() {
  const args = process.argv;
  
  if (args.includes('-s') || args.includes('--silent')) {
    return 3; // totally silent
  }
  if (args.includes('-e') || args.includes('--errors')) {
    return 2; // only errors
  }
  if (args.includes('-q') || args.includes('--quiet')) {
    return 1; // no header
  }
  
  return 0; // normal
}

/**
 * Check if we should show the header
 * @returns {boolean}
 */
export function shouldShowHeader() {
  return getQuietLevel() === 0;
}

/**
 * Check if we should show normal output
 * @returns {boolean}
 */
export function shouldShowOutput() {
  return getQuietLevel() < 2;
}

/**
 * Check if we should show error output
 * @returns {boolean}
 */
export function shouldShowErrors() {
  return getQuietLevel() < 3;
}

/**
 * Wrapper for console.log that respects quiet flags
 * @param {...any} args - Arguments to pass to console.log
 */
export function quietLog(...args) {
  if (shouldShowOutput()) {
    console.log(...args);
  }
}

/**
 * Wrapper for console.error that respects quiet flags
 * @param {...any} args - Arguments to pass to console.error
 */
export function quietError(...args) {
  if (shouldShowErrors()) {
    console.error(...args);
  }
}
