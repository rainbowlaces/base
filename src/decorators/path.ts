/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseRequestHandler } from "../core/baseRequestHandler";
import { pathToRegexp } from "path-to-regexp";
/**
 * Specifies the URL path that a middleware method should handle, allowing for pattern matching and parameter
 * extraction from the request URL. Used together with @middleware, it routes HTTP requests to the appropriate
 * middleware based on their path. This decorator enables the creation of modular and organized routing logic
 * within classes, supporting the development of clean and maintainable web applications.
 */
export default function path(pathStr: string) {
  return function (
    target: BaseRequestHandler,
    context: ClassMethodDecoratorContext,
  ): any {
    if (context.kind !== "method") return;

    try {
      pathToRegexp(pathStr);
    } catch (e) {
      throw new Error(
        `Invalid path: ${pathStr}. Error: ${(e as Error).message}`,
      );
    }

    target.path = pathStr;
    return target;
  };
}
