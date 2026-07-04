/**
 * Structured error logging for production debugging.
 * Logs all errors server-side so you have production visibility.
 * In development, also logs to console for quick feedback.
 */

export type ErrorContext = {
  endpoint?: string;
  userId?: string;
  lessonId?: string;
  languageId?: string;
  [key: string]: unknown;
};

export async function logServerError(
  error: Error | unknown,
  context: ErrorContext = {},
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : "";

  // In development, log to console immediately for quick debugging
  if (process.env.NODE_ENV === "development") {
    console.error("[SERVER ERROR]", {
      message: errorMessage,
      stack: errorStack,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  // Send to server logging service
  // This runs in all environments so you have production visibility
  try {
    // You can replace this with your actual logging service
    // Examples: Sentry, LogRocket, DataDog, CloudWatch, etc.
    if (typeof fetch !== "undefined") {
      await fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: errorMessage,
          stack: errorStack,
          context,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
        }),
      }).catch(() => {
        // Silently fail if logging endpoint is unavailable
        // to avoid cascading errors
      });
    }
  } catch {
    // Ignore logging errors to prevent them from crashing the app
  }
}

/**
 * Wraps an async function with error logging
 */
export function withErrorLogging<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context: ErrorContext = {},
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      await logServerError(error, context);
      throw error;
    }
  };
}
