export function debugLog(message: string, ...args: unknown[]): void {
  if (process.env.DEBUG) {
    console.log(message, ...args);
  }
}
