export class BaseError<T extends Error = Error> extends Error {
  private _wrappedError?: T;

  get wrappedError(): T | undefined {
    return this._wrappedError;
  }

  constructor(messageOrError: string | T, wrappedError?: T) {
    super();

    if (typeof messageOrError === "string") {
      this.initializeFromString(messageOrError, wrappedError);
    } else if (messageOrError instanceof Error) {
      this.initializeFromError(messageOrError);
    } else {
      throw new TypeError(
        "Invalid constructor arguments. Expected an Error or a message string followed optionally by an Error.",
      );
    }

    this.name = this.constructor.name;
    this.updateStack();
  }

  private initializeFromString(message: string, error?: T): void {
    this.message = message;
    if (error instanceof Error) {
      this._wrappedError = error;
    }
  }

  private initializeFromError(error: T): void {
    this.message = error.message;
    this._wrappedError = error;
  }

  private updateStack(): void {
    if (this._wrappedError?.stack) {
      this.stack = `${this.stack}\nCaused by:\n${this._wrappedError.stack}`;
    }
  }
}
