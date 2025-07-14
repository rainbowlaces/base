/**
 * Create an ASCII art box around text content
 * @param {string[]} lines - Array of text lines to display in the box
 * @param {string} title - Optional title for the box
 * @returns {string} The formatted ASCII art box
 */
export function createAsciiBox(lines, title = '') {
  if (!lines || lines.length === 0) {
    return '';
  }

  // Calculate the width needed for the box
  const maxLineLength = Math.max(...lines.map(line => line.length));
  const titleLength = title.length;
  const boxWidth = Math.max(maxLineLength, titleLength) + 4; // 2 spaces padding on each side

  // Create the box components
  const topBorder = '┌' + '─'.repeat(boxWidth - 2) + '┐';
  const bottomBorder = '└' + '─'.repeat(boxWidth - 2) + '┘';
  const _emptyLine = '│' + ' '.repeat(boxWidth - 2) + '│';

  let result = topBorder + '\n';

  // Add title if provided
  if (title) {
    const titlePadding = Math.floor((boxWidth - 2 - titleLength) / 2);
    const titleLine = '│' + ' '.repeat(titlePadding) + title + ' '.repeat(boxWidth - 2 - titlePadding - titleLength) + '│';
    result += titleLine + '\n';
    result += '│' + '─'.repeat(boxWidth - 2) + '│' + '\n';
  }

  // Add content lines
  for (const line of lines) {
    const padding = boxWidth - 2 - line.length;
    const paddedLine = '│ ' + line + ' '.repeat(padding - 1) + '│';
    result += paddedLine + '\n';
  }

  result += bottomBorder;
  return result;
}
