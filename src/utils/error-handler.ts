import { createLogger, format, transports } from "winston";

// Error Classes
export class PolyglotError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "PolyglotError";
  }
}

export class ModelError extends PolyglotError {
  constructor(message: string, code: string, public modelName: string) {
    super(message, code);
    this.name = "ModelError";
  }
}

export class NetworkError extends PolyglotError {
  constructor(message: string, public statusCode?: number) {
    super(message, "NETWORK_ERROR");
    this.name = "NetworkError";
  }
}

export class RateLimitError extends PolyglotError {
  constructor(message: string, public retryAfter?: number) {
    super(message, "RATE_LIMIT_ERROR");
    this.name = "RateLimitError";
  }
}

// Log Handling
export const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "polyglot-sdk" },
  transports: [
    new transports.File({ filename: "error.log", level: "error" }),
    new transports.File({ filename: "combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    })
  );
}

// Error handler function
export function handleError(error: Error): never {
  if (error instanceof PolyglotError) {
    logger.error(`${error.name}: ${error.message}`, {
      code: error.code,
      stack: error.stack,
    });
  } else {
    logger.error(`Unexpected error: ${error.message}`, { stack: error.stack });
  }
  throw error;
}
