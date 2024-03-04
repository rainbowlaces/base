/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseRequestHandler } from "../core/baseRequestHandler";

/**
 * Filters HTTP requests handled by a middleware method based on the request's HTTP method (e.g., GET, POST).
 * This decorator is used in conjunction with @middleware to further refine how requests are dispatched to
 * middleware functions, ensuring that only requests with the specified HTTP method are processed by the annotated
 * method. It is essential for creating RESTful interfaces where the behavior of a route varies with the HTTP method.
 */
export default function method(
  httpMethod:
    | "get"
    | "post"
    | "put"
    | "delete"
    | "patch"
    | "options"
    | "head"
    | "connect"
    | "trace",
) {
  return function (
    target: BaseRequestHandler,
    context: ClassMethodDecoratorContext,
  ): any {
    if (context.kind !== "method") return;

    target.httpMethod = httpMethod;
    return target;
  };
}
