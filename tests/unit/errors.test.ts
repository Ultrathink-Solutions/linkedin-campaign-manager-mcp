import { describe, it, expect } from 'vitest';
import {
  LinkedInApiError,
  AuthenticationError,
  PermissionError,
  RateLimitError,
  ValidationError,
  transformError,
} from '../../src/errors.js';

/**
 * Tests for our error handling and transformation logic.
 *
 * These tests verify OUR code for creating user-friendly error messages
 * and transforming API errors into structured error types.
 */

describe('LinkedInApiError', () => {
  it('creates error with all properties', () => {
    const error = new LinkedInApiError('Something went wrong', 500, 'SERVER_ERROR', { extra: 'data' });

    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(500);
    expect(error.errorCode).toBe('SERVER_ERROR');
    expect(error.details).toEqual({ extra: 'data' });
    expect(error.name).toBe('LinkedInApiError');
  });

  describe('toUserMessage', () => {
    it('provides friendly message for 401', () => {
      const error = new LinkedInApiError('Unauthorized', 401);
      expect(error.toUserMessage()).toContain('token may be expired');
    });

    it('provides friendly message for 403', () => {
      const error = new LinkedInApiError('Forbidden', 403);
      expect(error.toUserMessage()).toContain('Permission denied');
      expect(error.toUserMessage()).toContain('scopes');
    });

    it('provides friendly message for 404', () => {
      const error = new LinkedInApiError('Campaign not found', 404);
      expect(error.toUserMessage()).toContain('Resource not found');
      expect(error.toUserMessage()).toContain('Campaign not found');
    });

    it('provides friendly message for 429', () => {
      const error = new LinkedInApiError('Too many requests', 429);
      expect(error.toUserMessage()).toContain('Rate limit exceeded');
    });

    it('returns original message for other status codes', () => {
      const error = new LinkedInApiError('Internal error', 500);
      expect(error.toUserMessage()).toBe('Internal error');
    });
  });
});

describe('AuthenticationError', () => {
  it('has correct properties', () => {
    const error = new AuthenticationError('Token expired');

    expect(error.statusCode).toBe(401);
    expect(error.errorCode).toBe('AUTHENTICATION_ERROR');
    expect(error.name).toBe('AuthenticationError');
  });
});

describe('PermissionError', () => {
  it('has correct properties', () => {
    const error = new PermissionError('Missing rw_ads scope');

    expect(error.statusCode).toBe(403);
    expect(error.errorCode).toBe('PERMISSION_ERROR');
    expect(error.name).toBe('PermissionError');
  });
});

describe('RateLimitError', () => {
  it('has correct properties including retryAfter', () => {
    const error = new RateLimitError('Rate limited', 60);

    expect(error.statusCode).toBe(429);
    expect(error.errorCode).toBe('RATE_LIMIT_ERROR');
    expect(error.retryAfter).toBe(60);
    expect(error.name).toBe('RateLimitError');
  });
});

describe('ValidationError', () => {
  it('includes field information', () => {
    const error = new ValidationError('Invalid budget', 'dailyBudget');

    expect(error.message).toBe('Invalid budget');
    expect(error.field).toBe('dailyBudget');
    expect(error.name).toBe('ValidationError');
  });
});

describe('transformError', () => {
  it('transforms 401 axios error to AuthenticationError', () => {
    const axiosError = {
      response: {
        status: 401,
        data: { message: 'Invalid token' },
      },
    };

    const transformed = transformError(axiosError);

    expect(transformed).toBeInstanceOf(AuthenticationError);
    expect(transformed.message).toBe('Invalid token');
  });

  it('transforms 403 axios error to PermissionError', () => {
    const axiosError = {
      response: {
        status: 403,
        data: { message: 'Insufficient permissions' },
      },
    };

    const transformed = transformError(axiosError);

    expect(transformed).toBeInstanceOf(PermissionError);
  });

  it('transforms 429 axios error to RateLimitError with retryAfter', () => {
    const axiosError = {
      response: {
        status: 429,
        data: { message: 'Too many requests' },
        headers: { 'retry-after': '30' },
      },
    };

    const transformed = transformError(axiosError);

    expect(transformed).toBeInstanceOf(RateLimitError);
    expect((transformed as RateLimitError).retryAfter).toBe(30);
  });

  it('transforms other status codes to LinkedInApiError', () => {
    const axiosError = {
      response: {
        status: 500,
        data: { message: 'Server error', code: 'INTERNAL_ERROR' },
      },
    };

    const transformed = transformError(axiosError);

    expect(transformed).toBeInstanceOf(LinkedInApiError);
    expect((transformed as LinkedInApiError).statusCode).toBe(500);
  });

  it('returns existing LinkedInApiError unchanged', () => {
    const original = new LinkedInApiError('Original', 400);
    const transformed = transformError(original);

    expect(transformed).toBe(original);
  });

  it('returns existing ValidationError unchanged', () => {
    const original = new ValidationError('Bad input', 'field');
    const transformed = transformError(original);

    expect(transformed).toBe(original);
  });

  it('wraps unknown errors', () => {
    const transformed = transformError('string error');

    expect(transformed).toBeInstanceOf(Error);
    expect(transformed.message).toBe('string error');
  });

  it('handles axios error without response data', () => {
    const axiosError = {
      response: {
        status: 404,
      },
      message: 'Not found',
    };

    const transformed = transformError(axiosError);

    expect(transformed).toBeInstanceOf(LinkedInApiError);
    expect(transformed.message).toBe('Not found');
  });
});
