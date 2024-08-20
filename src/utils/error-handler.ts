export class PolyglotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolyglotError";
  }
}

export class RetryableError extends PolyglotError {
  constructor(message: string) {
    super(message);
    this.name = "RetryableError";
  }
}
