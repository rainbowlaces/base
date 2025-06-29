/**
 * Console abstraction interface to allow dependency injection and easier testing.
 * Mirrors the essential console methods used by the logger.
 */
export interface Console {
  log(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
  warn(message?: any, ...optionalParams: any[]): void;
  debug(message?: any, ...optionalParams: any[]): void;
  trace(message?: any, ...optionalParams: any[]): void;
}

import { registerDi } from "../di/decorators/registerDi";

/**
 * Default implementation that delegates to the global console object.
 */
@registerDi()
export class NodeConsole implements Console {
  public log(message?: any, ...optionalParams: any[]): void {
    console.log(message, ...optionalParams);
  }

  public error(message?: any, ...optionalParams: any[]): void {
    console.error(message, ...optionalParams);
  }

  public warn(message?: any, ...optionalParams: any[]): void {
    console.warn(message, ...optionalParams);
  }

  public debug(message?: any, ...optionalParams: any[]): void {
    console.debug(message, ...optionalParams);
  }

  public trace(message?: any, ...optionalParams: any[]): void {
    console.trace(message, ...optionalParams);
  }
}
