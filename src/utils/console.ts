/**
 * Console abstraction interface to allow dependency injection and easier testing.
 * Mirrors the essential console methods used by the logger.
 */
export interface Console {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(message?: any, ...optionalParams: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(message?: any, ...optionalParams: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(message?: any, ...optionalParams: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(message?: any, ...optionalParams: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trace(message?: any, ...optionalParams: any[]): void;
}

/**
 * Default implementation that delegates to the global console object.
 */
export class NodeConsole implements Console {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public log(message?: any, ...optionalParams: any[]): void {
     
    console.log(message, ...optionalParams);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public error(message?: any, ...optionalParams: any[]): void {
     
    console.error(message, ...optionalParams);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public warn(message?: any, ...optionalParams: any[]): void {
     
    console.warn(message, ...optionalParams);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public debug(message?: any, ...optionalParams: any[]): void {
     
    console.debug(message, ...optionalParams);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public trace(message?: any, ...optionalParams: any[]): void {
     
    console.trace(message, ...optionalParams);
  }
}
