import { RestliClient } from 'linkedin-api-client';
import type { Config } from './config.js';
import { transformError, RateLimitError } from './errors.js';

/**
 * Wrapper around the official LinkedIn API client.
 * Handles versioning, error transformation, and rate limit retry.
 */
export class LinkedInClient {
  private readonly restliClient: RestliClient;
  private readonly accessToken: string;
  private readonly apiVersion: string;

  constructor(config: Config) {
    this.restliClient = new RestliClient();
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion;
  }

  /**
   * Execute a finder query (search/list operations)
   */
  async finder<T>(
    resourcePath: string,
    finderName: string,
    queryParams?: Record<string, unknown>
  ): Promise<T> {
    return this.executeWithRetry(async () => {
      const response = await this.restliClient.finder({
        resourcePath,
        finderName,
        queryParams: queryParams ?? {},
        accessToken: this.accessToken,
        versionString: this.apiVersion,
      });
      return response.data as T;
    });
  }

  /**
   * Get a single entity by ID
   */
  async get<T>(resourcePath: string, id: string): Promise<T> {
    return this.executeWithRetry(async () => {
      const response = await this.restliClient.get({
        resourcePath: `${resourcePath}/${id}`,
        accessToken: this.accessToken,
        versionString: this.apiVersion,
      });
      return response.data as T;
    });
  }

  /**
   * Get all entities (when pagination is not needed)
   */
  async getAll<T>(resourcePath: string): Promise<T> {
    return this.executeWithRetry(async () => {
      const response = await this.restliClient.getAll({
        resourcePath,
        accessToken: this.accessToken,
        versionString: this.apiVersion,
      });
      return response.data as T;
    });
  }

  /**
   * Create a new entity
   */
  async create<T>(resourcePath: string, entity: Record<string, unknown>): Promise<T> {
    return this.executeWithRetry(async () => {
      const response = await this.restliClient.create({
        resourcePath,
        entity,
        accessToken: this.accessToken,
        versionString: this.apiVersion,
      });
      return response.data as T;
    });
  }

  /**
   * Update an existing entity (full replacement)
   */
  async update(resourcePath: string, id: string, entity: Record<string, unknown>): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.restliClient.update({
        resourcePath: `${resourcePath}/${id}`,
        entity,
        accessToken: this.accessToken,
        versionString: this.apiVersion,
      });
    });
  }

  /**
   * Partially update an entity
   */
  async partialUpdate(
    resourcePath: string,
    id: string,
    patchSet: Record<string, unknown>
  ): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.restliClient.partialUpdate({
        resourcePath: `${resourcePath}/${id}`,
        patchSetEntity: patchSet,
        accessToken: this.accessToken,
        versionString: this.apiVersion,
      });
    });
  }

  /**
   * Delete an entity
   */
  async delete(resourcePath: string, id: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.restliClient.delete({
        resourcePath: `${resourcePath}/${id}`,
        accessToken: this.accessToken,
        versionString: this.apiVersion,
      });
    });
  }

  /**
   * Execute with exponential backoff retry for rate limits
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = transformError(error);

        // Only retry on rate limit errors
        if (lastError instanceof RateLimitError && attempt < maxRetries) {
          const waitTime = lastError.retryAfter
            ? lastError.retryAfter * 1000
            : Math.pow(2, attempt) * 1000; // Exponential backoff

          await this.sleep(waitTime);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error('Unknown error during retry');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create a LinkedInClient instance
 */
export function createLinkedInClient(config: Config): LinkedInClient {
  return new LinkedInClient(config);
}
