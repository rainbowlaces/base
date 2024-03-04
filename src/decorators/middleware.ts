/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseRequestHandler } from "../core/baseRequestHandler";

/**
 * Marks a class method as middleware, making it a part of the request handling pipeline in the Express application.
 * This decorator is fundamental for integrating methods directly into the flow of HTTP request processing, allowing
 * for operations like request parsing, response formatting, or custom authentication checks. When combined with
 * @method and/or @path decorators, it enables fine-tuned control over which HTTP requests a middleware method should
 * process, based on the request's HTTP method and URL path.
 */
export default function middleware(
  middlewareMethod: BaseRequestHandler,
  context: ClassMethodDecoratorContext,
): any {
  if (context.kind !== "method") return;

  middlewareMethod.isMiddleware = true;
}
