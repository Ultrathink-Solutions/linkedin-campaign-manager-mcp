import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAdAccounts, getAdAccount, accountTools } from '../../../src/tools/accounts.js';
import type { LinkedInClient } from '../../../src/client.js';

/**
 * Tests for account tool handlers.
 */

describe('Account Tools', () => {
  let mockClient: LinkedInClient;

  beforeEach(() => {
    mockClient = {
      finder: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      partialUpdate: vi.fn(),
      delete: vi.fn(),
    } as unknown as LinkedInClient;
  });

  describe('listAdAccounts', () => {
    it('lists all accessible ad accounts', async () => {
      const mockResponse = {
        elements: [
          {
            id: 'urn:li:sponsoredAccount:111',
            name: 'Account One',
            status: 'ACTIVE',
            currency: 'USD',
            type: 'BUSINESS',
          },
          {
            id: 'urn:li:sponsoredAccount:222',
            name: 'Account Two',
            status: 'ACTIVE',
            currency: 'EUR',
            type: 'ENTERPRISE',
          },
        ],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await listAdAccounts({}, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.finder).toHaveBeenCalledWith('/adAccounts', 'search', {});
      expect(parsed.count).toBe(2);
      expect(parsed.accounts[0]).toEqual({
        id: '111',
        name: 'Account One',
        status: 'ACTIVE',
        currency: 'USD',
        type: 'BUSINESS',
      });
      expect(parsed.accounts[1].id).toBe('222');
    });

    it('returns empty array when no accounts', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      const result = await listAdAccounts({}, mockClient);
      const parsed = JSON.parse(result);

      expect(parsed.count).toBe(0);
      expect(parsed.accounts).toEqual([]);
    });
  });

  describe('getAdAccount', () => {
    it('gets a specific account by ID', async () => {
      const mockResponse = {
        id: 'urn:li:sponsoredAccount:123',
        name: 'My Account',
        status: 'ACTIVE',
        currency: 'USD',
        type: 'BUSINESS',
      };
      vi.mocked(mockClient.get).mockResolvedValue(mockResponse);

      const result = await getAdAccount({ accountId: '123' }, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/adAccounts', '123');
      expect(parsed.id).toBe('123');
      expect(parsed.name).toBe('My Account');
    });

    it('formats account response correctly with all fields', async () => {
      const mockResponse = {
        id: 'urn:li:sponsoredAccount:999888777',
        name: 'Enterprise Account',
        status: 'PAUSED',
        currency: 'EUR',
        type: 'ENTERPRISE',
      };
      vi.mocked(mockClient.get).mockResolvedValue(mockResponse);

      const result = await getAdAccount({ accountId: '999888777' }, mockClient);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({
        id: '999888777',
        name: 'Enterprise Account',
        status: 'PAUSED',
        currency: 'EUR',
        type: 'ENTERPRISE',
      });
    });
  });

  describe('tool definitions', () => {
    it('exports correct tool structure', () => {
      expect(accountTools).toHaveProperty('list_ad_accounts');
      expect(accountTools).toHaveProperty('get_ad_account');

      for (const tool of Object.values(accountTools)) {
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(tool).toHaveProperty('handler');
      }
    });
  });
});
