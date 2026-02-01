import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LinkedInClient, createLinkedInClient } from '../../src/client.js';
import { RateLimitError, LinkedInApiError, AuthenticationError } from '../../src/errors.js';

// Mock the linkedin-api-client module
vi.mock('linkedin-api-client', () => ({
  RestliClient: vi.fn().mockImplementation(() => ({
    finder: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    partialUpdate: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Import after mocking
import { RestliClient } from 'linkedin-api-client';

describe('LinkedInClient', () => {
  const mockConfig = {
    accessToken: 'test-token',
    apiVersion: '202601',
    debug: false,
  };

  let client: LinkedInClient;
  let mockRestliClient: ReturnType<typeof vi.mocked<RestliClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    client = new LinkedInClient(mockConfig);
    // Get the mock instance created by the constructor
    mockRestliClient = vi.mocked(RestliClient).mock.results[0].value;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createLinkedInClient', () => {
    it('creates a LinkedInClient instance', () => {
      const newClient = createLinkedInClient(mockConfig);
      expect(newClient).toBeInstanceOf(LinkedInClient);
    });
  });

  describe('finder', () => {
    it('calls RestliClient.finder with correct parameters', async () => {
      const mockResponse = { data: { elements: [{ id: '123' }] } };
      mockRestliClient.finder.mockResolvedValue(mockResponse);

      const result = await client.finder('/adAccounts', 'search', { q: 'test' });

      expect(mockRestliClient.finder).toHaveBeenCalledWith({
        resourcePath: '/adAccounts',
        finderName: 'search',
        queryParams: { q: 'test' },
        accessToken: 'test-token',
        versionString: '202601',
      });
      expect(result).toEqual({ elements: [{ id: '123' }] });
    });

    it('uses empty object for undefined queryParams', async () => {
      mockRestliClient.finder.mockResolvedValue({ data: {} });

      await client.finder('/adAccounts', 'search');

      expect(mockRestliClient.finder).toHaveBeenCalledWith(
        expect.objectContaining({ queryParams: {} })
      );
    });
  });

  describe('get', () => {
    it('calls RestliClient.get with resource path and ID', async () => {
      const mockResponse = { data: { id: '123', name: 'Test' } };
      mockRestliClient.get.mockResolvedValue(mockResponse);

      const result = await client.get('/adAccounts', '123');

      expect(mockRestliClient.get).toHaveBeenCalledWith({
        resourcePath: '/adAccounts/123',
        accessToken: 'test-token',
        versionString: '202601',
      });
      expect(result).toEqual({ id: '123', name: 'Test' });
    });
  });

  describe('getAll', () => {
    it('calls RestliClient.getAll with resource path', async () => {
      const mockResponse = { data: { elements: [] } };
      mockRestliClient.getAll.mockResolvedValue(mockResponse);

      const result = await client.getAll('/adAccounts');

      expect(mockRestliClient.getAll).toHaveBeenCalledWith({
        resourcePath: '/adAccounts',
        accessToken: 'test-token',
        versionString: '202601',
      });
      expect(result).toEqual({ elements: [] });
    });
  });

  describe('create', () => {
    it('calls RestliClient.create with entity data', async () => {
      const entity = { name: 'New Campaign' };
      const mockResponse = { data: { id: '456', name: 'New Campaign' } };
      mockRestliClient.create.mockResolvedValue(mockResponse);

      const result = await client.create('/campaigns', entity);

      expect(mockRestliClient.create).toHaveBeenCalledWith({
        resourcePath: '/campaigns',
        entity,
        accessToken: 'test-token',
        versionString: '202601',
      });
      expect(result).toEqual({ id: '456', name: 'New Campaign' });
    });
  });

  describe('update', () => {
    it('calls RestliClient.update with full entity replacement', async () => {
      const entity = { name: 'Updated Campaign', status: 'ACTIVE' };
      mockRestliClient.update.mockResolvedValue(undefined);

      await client.update('/campaigns', '123', entity);

      expect(mockRestliClient.update).toHaveBeenCalledWith({
        resourcePath: '/campaigns/123',
        entity,
        accessToken: 'test-token',
        versionString: '202601',
      });
    });
  });

  describe('partialUpdate', () => {
    it('calls RestliClient.partialUpdate with patch set', async () => {
      const patchSet = { status: 'PAUSED' };
      mockRestliClient.partialUpdate.mockResolvedValue(undefined);

      await client.partialUpdate('/campaigns', '123', patchSet);

      expect(mockRestliClient.partialUpdate).toHaveBeenCalledWith({
        resourcePath: '/campaigns/123',
        patchSetObject: patchSet,
        accessToken: 'test-token',
        versionString: '202601',
      });
    });
  });

  describe('delete', () => {
    it('calls RestliClient.delete with resource path and ID', async () => {
      mockRestliClient.delete.mockResolvedValue(undefined);

      await client.delete('/campaigns', '123');

      expect(mockRestliClient.delete).toHaveBeenCalledWith({
        resourcePath: '/campaigns/123',
        accessToken: 'test-token',
        versionString: '202601',
      });
    });
  });

  describe('retry logic', () => {
    it('retries on rate limit error with exponential backoff', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          data: { message: 'Rate limited' },
          headers: {},
        },
      };

      mockRestliClient.get
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: { id: '123' } });

      const resultPromise = client.get('/test', '123');

      // Advance timers to handle the retry delay
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(mockRestliClient.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ id: '123' });
    });

    it('respects retry-after header', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          data: { message: 'Rate limited' },
          headers: { 'retry-after': '1' },
        },
      };

      mockRestliClient.get
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: { id: '123' } });

      const resultPromise = client.get('/test', '123');

      // Advance timers by exactly 1000ms to match the retry-after header (1 second)
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      // Verify the retry occurred after honoring the Retry-After value
      expect(mockRestliClient.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ id: '123' });
    });

    it('throws after max retries on persistent rate limit', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          data: { message: 'Rate limited' },
          headers: {},
        },
      };

      mockRestliClient.get.mockRejectedValue(rateLimitError);

      // Start the request and catch immediately to prevent unhandled rejection
      let caughtError: Error | null = null;
      const resultPromise = client.get('/test', '123').catch((e) => {
        caughtError = e;
      });

      // Advance timers to handle all retry delays (1s + 2s + 4s = 7s total)
      await vi.advanceTimersByTimeAsync(10000);

      await resultPromise;

      expect(caughtError).toBeInstanceOf(RateLimitError);
      expect(mockRestliClient.get).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('does not retry on authentication errors', async () => {
      const authError = {
        response: {
          status: 401,
          data: { message: 'Invalid token' },
        },
      };

      mockRestliClient.get.mockRejectedValue(authError);

      await expect(client.get('/test', '123')).rejects.toThrow(AuthenticationError);
      expect(mockRestliClient.get).toHaveBeenCalledTimes(1);
    });

    it('does not retry on other API errors', async () => {
      const apiError = {
        response: {
          status: 400,
          data: { message: 'Bad request' },
        },
      };

      mockRestliClient.get.mockRejectedValue(apiError);

      await expect(client.get('/test', '123')).rejects.toThrow(LinkedInApiError);
      expect(mockRestliClient.get).toHaveBeenCalledTimes(1);
    });
  });
});
