/**
 * Custom error classes for the LinkedIn Campaign Manager MCP server.
 * These provide structured error information for better debugging and user feedback.
 */

/**
 * Base error class for LinkedIn API errors
 */
export class LinkedInApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'LinkedInApiError';
  }

  /**
   * Create a user-friendly error message
   */
  toUserMessage(): string {
    switch (this.statusCode) {
      case 401:
        return 'Authentication failed. Your access token may be expired or invalid. Please generate a new token.';
      case 403:
        return 'Permission denied. Ensure your app has the required scopes (rw_ads, r_ads_reporting).';
      case 404:
        return `Resource not found. ${this.message}`;
      case 429:
        return 'Rate limit exceeded. Please wait before making more requests.';
      default:
        return this.message;
    }
  }
}

/**
 * Error for authentication/authorization issues
 */
export class AuthenticationError extends LinkedInApiError {
  constructor(message: string, details?: unknown) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error for permission/scope issues
 */
export class PermissionError extends LinkedInApiError {
  constructor(message: string, details?: unknown) {
    super(message, 403, 'PERMISSION_ERROR', details);
    this.name = 'PermissionError';
  }
}

/**
 * Error for rate limiting
 */
export class RateLimitError extends LinkedInApiError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
    details?: unknown
  ) {
    super(message, 429, 'RATE_LIMIT_ERROR', details);
    this.name = 'RateLimitError';
  }
}

/**
 * Error for validation failures (our code, not LinkedIn's)
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Error for configuration issues
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Transform an unknown error (from linkedin-api-client or axios) into our error types
 */
export function transformError(error: unknown): Error {
  // If it's already one of our custom errors, return it unchanged
  if (error instanceof LinkedInApiError) {
    return error;
  }

  if (error instanceof ValidationError) {
    return error;
  }

  // If it's already a standard Error (but not our custom types), return it
  if (error instanceof Error && !isAxiosError(error)) {
    return error;
  }

  // Handle axios-style errors (have response object)
  if (isAxiosError(error)) {
    const status = error.response?.status ?? 500;
    const data = error.response?.data as Record<string, unknown> | undefined;
    const message = (data?.message as string) ?? error.message ?? 'Unknown API error';

    switch (status) {
      case 401:
        return new AuthenticationError(message, data);
      case 403:
        return new PermissionError(message, data);
      case 429: {
        const retryAfter = error.response?.headers?.['retry-after'];
        return new RateLimitError(
          message,
          retryAfter ? parseInt(retryAfter as string, 10) : undefined,
          data
        );
      }
      default:
        return new LinkedInApiError(message, status, data?.code as string | undefined, data);
    }
  }

  // Unknown error type - wrap in Error
  return new Error(String(error));
}

/**
 * Type guard for axios-style errors
 */
function isAxiosError(
  error: unknown
): error is { response?: { status?: number; data?: unknown; headers?: Record<string, unknown> }; message?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('response' in error || 'message' in error)
  );
}
