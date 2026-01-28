import { z } from 'zod';

/**
 * Configuration schema for the LinkedIn Campaign Manager MCP server.
 * All configuration is sourced from environment variables.
 */
const configSchema = z.object({
  /** LinkedIn OAuth access token with rw_ads scope */
  accessToken: z.string().min(1, 'LINKEDIN_ACCESS_TOKEN is required'),
  /** LinkedIn API version in YYYYMM format (default: 202601) */
  apiVersion: z.string().regex(/^\d{6}$/, 'API version must be in YYYYMM format').default('202601'),
  /** Enable debug logging */
  debug: z.boolean().default(false),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables.
 * @throws {Error} If required environment variables are missing or invalid
 */
export function loadConfig(): Config {
  const rawConfig = {
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
    apiVersion: process.env.LINKEDIN_API_VERSION ?? '202601',
    debug: process.env.DEBUG === 'true',
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`);
    throw new Error(`Configuration error:\n${errors.join('\n')}`);
  }

  return result.data;
}

/**
 * Validate that the access token appears to be in a valid format.
 * This is a basic check - actual validation happens when the API is called.
 */
export function validateAccessToken(token: string): boolean {
  // LinkedIn access tokens typically start with 'AQ' and contain alphanumeric chars, underscores, dashes
  return token.length > 20 && /^[A-Za-z0-9_-]+$/.test(token);
}
