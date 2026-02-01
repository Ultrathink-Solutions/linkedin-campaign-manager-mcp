import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAnalytics,
  getCampaignPerformance,
  analyticsTools,
} from '../../../src/tools/analytics.js';
import type { LinkedInClient } from '../../../src/client.js';

/**
 * Tests for analytics tool handlers.
 */

describe('Analytics Tools', () => {
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

  describe('getAnalytics', () => {
    it('gets analytics with default metrics', async () => {
      const mockResponse = {
        elements: [
          {
            pivotValue: 'urn:li:sponsoredCampaign:123',
            impressions: 1000,
            clicks: 50,
            costInLocalCurrency: { amount: '100.00', currencyCode: 'USD' },
          },
        ],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await getAnalytics(
        {
          accountId: '456',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adAnalytics',
        'analytics',
        expect.objectContaining({
          dateRange: expect.any(Object),
          pivot: 'CAMPAIGN',
          timeGranularity: 'ALL',
          accounts: ['urn:li:sponsoredAccount:456'],
        })
      );
      expect(parsed.count).toBe(1);
      expect(parsed.analytics[0].impressions).toBe(1000);
      expect(parsed.analytics[0].clicks).toBe(50);
      expect(parsed.analytics[0].ctr).toBe('5.00%');
      expect(parsed.analytics[0].averageCpc).toEqual({
        amount: '2.00',
        currencyCode: 'USD',
      });
    });

    it('filters by campaign IDs when provided', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      await getAnalytics(
        {
          accountId: '456',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          campaignIds: ['111', '222'],
        },
        mockClient
      );

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adAnalytics',
        'analytics',
        expect.objectContaining({
          campaigns: [
            'urn:li:sponsoredCampaign:111',
            'urn:li:sponsoredCampaign:222',
          ],
        })
      );
    });

    it('uses custom metrics when specified', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      await getAnalytics(
        {
          accountId: '456',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          metrics: ['impressions', 'clicks'],
        },
        mockClient
      );

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adAnalytics',
        'analytics',
        expect.objectContaining({
          fields: 'impressions,clicks',
        })
      );
    });

    it('handles zero impressions without CTR', async () => {
      const mockResponse = {
        elements: [
          {
            pivotValue: 'test',
            impressions: 0,
            clicks: 0,
          },
        ],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await getAnalytics(
        {
          accountId: '456',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        },
        mockClient
      );
      const parsed = JSON.parse(result);

      // Should not have CTR when impressions is 0
      expect(parsed.analytics[0].ctr).toBeUndefined();
    });

    it('handles zero clicks without average CPC', async () => {
      const mockResponse = {
        elements: [
          {
            pivotValue: 'test',
            impressions: 1000,
            clicks: 0,
            costInLocalCurrency: { amount: '50.00', currencyCode: 'USD' },
          },
        ],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await getAnalytics(
        {
          accountId: '456',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(parsed.analytics[0].averageCpc).toBeUndefined();
    });

    it('supports different pivot types', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      await getAnalytics(
        {
          accountId: '456',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          pivot: 'CREATIVE',
        },
        mockClient
      );

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adAnalytics',
        'analytics',
        expect.objectContaining({
          pivot: 'CREATIVE',
        })
      );
    });
  });

  describe('getCampaignPerformance', () => {
    it('delegates to getAnalytics with campaign filter', async () => {
      const mockResponse = {
        elements: [
          {
            pivotValue: 'urn:li:sponsoredCampaign:123',
            impressions: 500,
            clicks: 25,
          },
        ],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await getCampaignPerformance(
        {
          accountId: '456',
          campaignId: '123',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adAnalytics',
        'analytics',
        expect.objectContaining({
          pivot: 'CAMPAIGN',
          campaigns: ['urn:li:sponsoredCampaign:123'],
        })
      );
      expect(parsed.analytics).toHaveLength(1);
    });
  });

  describe('tool definitions', () => {
    it('exports correct tool structure', () => {
      expect(analyticsTools).toHaveProperty('get_analytics');
      expect(analyticsTools).toHaveProperty('get_campaign_performance');

      for (const tool of Object.values(analyticsTools)) {
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(tool).toHaveProperty('handler');
      }
    });
  });
});
