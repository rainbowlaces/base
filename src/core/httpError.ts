/**
 * Custom error class for handling HTTP-related errors within the application. It extends the standard Error
 * class by adding a status code property, allowing for more precise error handling and response generation
 * in middleware and routes.
 */
export default class HttpError extends Error {
  statusCode: number;
  wrapped?: unknown;

  constructor(statusCode: number, wrappedError?: unknown) {
    super(`HTTP Error ${statusCode}`);
    this.statusCode = statusCode;
    this.wrapped = wrappedError;
  }
}
