/* eslint-disable @typescript-eslint/no-explicit-any */
import { Command } from "../core/commandQueue";
/**
 * Specifies the URL path that a middleware method should handle, allowing for pattern matching and parameter
 * extraction from the request URL. Used together with @middleware, it routes HTTP requests to the appropriate
 * middleware based on their path. This decorator enables the creation of modular and organized routing logic
 * within classes, supporting the development of clean and maintainable web applications.
 */
export default function command(queue: string[]) {
  return function (target: Command, context: ClassMethodDecoratorContext): any {
    if (context.kind !== "method") return;

    target.isCommand = true;
    target.queue = queue;
    return target;
  };
}
