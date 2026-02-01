import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getShareStatistics,
  getFollowerStatistics,
  getOrganization,
  organizationAnalyticsTools,
} from '../../../src/tools/organization-analytics.js';
import type { LinkedInClient } from '../../../src/client.js';

/**
 * Tests for organization analytics tool handlers (Community Management API).
 */

describe('Organization Analytics Tools', () => {
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

  describe('getShareStatistics', () => {
    it('gets share statistics for an organization', async () => {
      const mockResponse = {
        elements: [
          {
            totalShareStatistics: {
              impressionCount: 10000,
              uniqueImpressionsCount: 8000,
              clickCount: 500,
              likeCount: 200,
              commentCount: 50,
              shareCount: 30,
              engagement: 0.078,
            },
          },
        ],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await getShareStatistics({ organizationId: '12345' }, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/organizationalEntityShareStatistics',
        'organizationalEntity',
        expect.objectContaining({
          q: 'organizationalEntity',
          organizationalEntity: 'urn:li:organization:12345',
        })
      );
      expect(parsed.organizationId).toBe('12345');
      expect(parsed.dataAvailable).toBe(true);
      expect(parsed.totalStats.impressions).toBe(10000);
      expect(parsed.totalStats.clicks).toBe(500);
      expect(parsed.totalStats.likes).toBe(200);
    });

    it('includes time range when dates provided', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      const result = await getShareStatistics(
        {
          organizationId: '12345',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          granularity: 'DAY',
        },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/organizationalEntityShareStatistics',
        'organizationalEntity',
        expect.objectContaining({
          timeIntervals: expect.objectContaining({
            timeGranularityType: 'DAY',
          }),
        })
      );
      expect(parsed.timeRange).toEqual({
        start: '2026-01-01',
        end: '2026-01-31',
      });
    });

    it('handles empty response', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      const result = await getShareStatistics({ organizationId: '12345' }, mockClient);
      const parsed = JSON.parse(result);

      expect(parsed.dataAvailable).toBe(false);
      expect(parsed.totalStats.impressions).toBe(0);
    });

    it('throws validation error for invalid response', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({
        elements: [{ totalShareStatistics: { impressionCount: 'not a number' } }],
      });

      await expect(
        getShareStatistics({ organizationId: '12345' }, mockClient)
      ).rejects.toThrow('Invalid share statistics response');
    });
  });

  describe('getFollowerStatistics', () => {
    it('gets follower statistics for an organization', async () => {
      const mockResponse = {
        elements: [
          {
            followerCounts: {
              organicFollowerCount: 5000,
              paidFollowerCount: 500,
            },
          },
        ],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await getFollowerStatistics({ organizationId: '12345' }, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/organizationalEntityFollowerStatistics',
        'organizationalEntity',
        expect.objectContaining({
          q: 'organizationalEntity',
          organizationalEntity: 'urn:li:organization:12345',
        })
      );
      expect(parsed.totalFollowers).toBe(5500);
      expect(parsed.organicFollowers).toBe(5000);
      expect(parsed.paidFollowers).toBe(500);
    });

    it('includes demographics when available', async () => {
      const mockResponse = {
        elements: [
          {
            followerCounts: { organicFollowerCount: 1000, paidFollowerCount: 0 },
            followerCountsByFunction: [
              {
                function: 'urn:li:function:12',
                followerCounts: { organicFollowerCount: 300, paidFollowerCount: 0 },
              },
            ],
            followerCountsBySeniority: [
              {
                seniority: 'urn:li:seniority:5',
                followerCounts: { organicFollowerCount: 200, paidFollowerCount: 0 },
              },
            ],
            followerCountsByIndustry: [
              {
                industry: 'urn:li:industry:4',
                followerCounts: { organicFollowerCount: 150, paidFollowerCount: 0 },
              },
            ],
            followerCountsByGeoCountry: [
              {
                geo: 'urn:li:geo:103644278',
                followerCounts: { organicFollowerCount: 400, paidFollowerCount: 0 },
              },
            ],
            followerCountsByStaffCountRange: [
              {
                staffCountRange: 'SIZE_51_TO_200',
                followerCounts: { organicFollowerCount: 250, paidFollowerCount: 0 },
              },
            ],
          },
        ],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await getFollowerStatistics({ organizationId: '12345' }, mockClient);
      const parsed = JSON.parse(result);

      expect(parsed.demographics).toBeDefined();
      expect(parsed.demographics.byFunction['12']).toBe(300);
      expect(parsed.demographics.bySeniority['5']).toBe(200);
      expect(parsed.demographics.byIndustry['4']).toBe(150);
      expect(parsed.demographics.byLocation['103644278']).toBe(400);
      expect(parsed.demographics.byCompanySize['SIZE_51_TO_200']).toBe(250);
    });

    it('includes time range when dates provided', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({
        elements: [{ followerCounts: { organicFollowerCount: 100, paidFollowerCount: 0 } }],
      });

      const result = await getFollowerStatistics(
        {
          organizationId: '12345',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(parsed.timeRange).toEqual({
        start: '2026-01-01',
        end: '2026-01-31',
      });
    });

    it('handles empty response', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      const result = await getFollowerStatistics({ organizationId: '12345' }, mockClient);
      const parsed = JSON.parse(result);

      expect(parsed.dataAvailable).toBe(false);
      expect(parsed.totalFollowers).toBe(0);
    });

    it('throws validation error for invalid response', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({
        elements: [{ followerCounts: { organicFollowerCount: 'invalid' } }],
      });

      await expect(
        getFollowerStatistics({ organizationId: '12345' }, mockClient)
      ).rejects.toThrow('Invalid follower statistics response');
    });
  });

  describe('getOrganization', () => {
    it('gets organization details', async () => {
      const mockResponse = {
        localizedName: 'Acme Corp',
        vanityName: 'acme-corp',
        localizedDescription: 'We make everything',
        localizedWebsite: 'https://acme.com',
        industries: ['urn:li:industry:4', 'urn:li:industry:96'],
        localizedSpecialties: ['Software', 'AI'],
        staffCountRange: 'SIZE_501_TO_1000',
        logoV2: {
          original: 'https://media.licdn.com/logo.png',
        },
      };
      vi.mocked(mockClient.get).mockResolvedValue(mockResponse);

      const result = await getOrganization({ organizationId: '12345' }, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/organizations', '12345');
      expect(parsed.id).toBe('12345');
      expect(parsed.name).toBe('Acme Corp');
      expect(parsed.vanityName).toBe('acme-corp');
      expect(parsed.description).toBe('We make everything');
      expect(parsed.websiteUrl).toBe('https://acme.com');
      expect(parsed.industries).toEqual(['4', '96']);
      expect(parsed.specialties).toEqual(['Software', 'AI']);
      expect(parsed.staffCount).toBe('SIZE_501_TO_1000');
      expect(parsed.logoUrl).toBe('https://media.licdn.com/logo.png');
    });

    it('handles minimal response', async () => {
      const mockResponse = {
        name: 'Simple Org',
      };
      vi.mocked(mockClient.get).mockResolvedValue(mockResponse);

      const result = await getOrganization({ organizationId: '99999' }, mockClient);
      const parsed = JSON.parse(result);

      expect(parsed.id).toBe('99999');
      expect(parsed.name).toBe('Simple Org');
      expect(parsed.vanityName).toBeUndefined();
    });

    it('throws validation error for invalid response', async () => {
      vi.mocked(mockClient.get).mockResolvedValue({
        industries: 'not an array',
      });

      await expect(
        getOrganization({ organizationId: '12345' }, mockClient)
      ).rejects.toThrow('Invalid organization response');
    });
  });

  describe('tool definitions', () => {
    it('exports correct tool structure', () => {
      expect(organizationAnalyticsTools).toHaveProperty('get_share_statistics');
      expect(organizationAnalyticsTools).toHaveProperty('get_follower_statistics');
      expect(organizationAnalyticsTools).toHaveProperty('get_organization');

      for (const tool of Object.values(organizationAnalyticsTools)) {
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(tool).toHaveProperty('handler');
      }
    });
  });
});
