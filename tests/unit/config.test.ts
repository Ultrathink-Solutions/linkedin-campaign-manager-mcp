import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, validateAccessToken } from '../../src/config.js';

/**
 * Tests for our configuration loading and validation logic.
 *
 * These tests verify OUR code for parsing environment variables and
 * validating configuration. We're NOT testing Zod's parsing capabilities.
 */

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads valid configuration from environment', () => {
    process.env.LINKEDIN_ACCESS_TOKEN = 'AQV123456789abcdef';
    process.env.LINKEDIN_API_VERSION = '202601';

    const config = loadConfig();

    expect(config.accessToken).toBe('AQV123456789abcdef');
    expect(config.apiVersion).toBe('202601');
    expect(config.debug).toBe(false);
  });

  it('uses default API version when not specified', () => {
    process.env.LINKEDIN_ACCESS_TOKEN = 'AQV123456789abcdef';
    delete process.env.LINKEDIN_API_VERSION;

    const config = loadConfig();

    expect(config.apiVersion).toBe('202601');
  });

  it('parses debug flag correctly', () => {
    process.env.LINKEDIN_ACCESS_TOKEN = 'AQV123456789abcdef';
    process.env.DEBUG = 'true';

    const config = loadConfig();

    expect(config.debug).toBe(true);
  });

  it('throws error when access token is missing', () => {
    delete process.env.LINKEDIN_ACCESS_TOKEN;

    expect(() => loadConfig()).toThrow('Configuration error');
  });

  it('throws error when access token is empty', () => {
    process.env.LINKEDIN_ACCESS_TOKEN = '';

    expect(() => loadConfig()).toThrow('LINKEDIN_ACCESS_TOKEN is required');
  });

  it('throws error for invalid API version format', () => {
    process.env.LINKEDIN_ACCESS_TOKEN = 'AQV123456789abcdef';
    process.env.LINKEDIN_API_VERSION = '2026-01'; // Wrong format

    expect(() => loadConfig()).toThrow('API version must be in YYYYMM format');
  });

  it('throws error for API version with wrong length', () => {
    process.env.LINKEDIN_ACCESS_TOKEN = 'AQV123456789abcdef';
    process.env.LINKEDIN_API_VERSION = '20261'; // Too short

    expect(() => loadConfig()).toThrow('API version must be in YYYYMM format');
  });
});

describe('validateAccessToken', () => {
  it('returns true for valid-looking token', () => {
    expect(validateAccessToken('AQV123456789abcdefghijk')).toBe(true);
  });

  it('returns true for token with underscores and dashes', () => {
    // Token must be > 20 chars, so use a longer example
    expect(validateAccessToken('AQV_123-456_789-abcdefghij')).toBe(true);
  });

  it('returns false for token that is too short', () => {
    expect(validateAccessToken('AQV123')).toBe(false);
  });

  it('returns false for token with invalid characters', () => {
    expect(validateAccessToken('AQV123456789!@#$%^&*()')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateAccessToken('')).toBe(false);
  });
});
