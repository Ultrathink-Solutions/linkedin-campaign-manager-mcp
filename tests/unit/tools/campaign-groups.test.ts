import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listCampaignGroups,
  createCampaignGroup,
  updateCampaignGroup,
  campaignGroupTools,
} from '../../../src/tools/campaign-groups.js';
import type { LinkedInClient } from '../../../src/client.js';

/**
 * Tests for campaign group tool handlers.
 */

describe('Campaign Group Tools', () => {
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

  describe('listCampaignGroups', () => {
    it('lists campaign groups for an account', async () => {
      const mockResponse = {
        elements: [
          {
            id: 'urn:li:sponsoredCampaignGroup:111',
            name: 'Summer Campaign',
            status: 'ACTIVE',
            totalBudget: { amount: '1000', currencyCode: 'USD' },
          },
          {
            id: 'urn:li:sponsoredCampaignGroup:222',
            name: 'Winter Campaign',
            status: 'PAUSED',
          },
        ],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await listCampaignGroups({ accountId: '456' }, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adAccounts/456/adCampaignGroups',
        'search',
        {}
      );
      expect(parsed.count).toBe(2);
      expect(parsed.campaignGroups[0]).toEqual({
        id: '111',
        name: 'Summer Campaign',
        status: 'ACTIVE',
        totalBudget: { amount: '1000', currencyCode: 'USD' },
      });
      expect(parsed.campaignGroups[1].totalBudget).toBeUndefined();
    });

    it('propagates client errors', async () => {
      const apiError = new Error('LinkedIn API unavailable');
      vi.mocked(mockClient.finder).mockRejectedValue(apiError);

      await expect(
        listCampaignGroups({ accountId: '456' }, mockClient)
      ).rejects.toThrow(apiError);
    });
  });

  describe('createCampaignGroup', () => {
    it('creates a campaign group with required fields', async () => {
      const mockResponse = {
        id: 'urn:li:sponsoredCampaignGroup:999',
        name: 'New Group',
        status: 'ACTIVE',
      };
      vi.mocked(mockClient.create).mockResolvedValue(mockResponse);

      const result = await createCampaignGroup(
        { accountId: '456', name: 'New Group' },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.create).toHaveBeenCalledWith(
        '/adAccounts/456/adCampaignGroups',
        expect.objectContaining({
          account: 'urn:li:sponsoredAccount:456',
          name: 'New Group',
          status: 'ACTIVE',
        })
      );
      expect(parsed.message).toBe('Campaign group created successfully');
      expect(parsed.campaignGroup.id).toBe('999');
    });

    it('includes total budget when provided', async () => {
      vi.mocked(mockClient.create).mockResolvedValue({
        id: 'urn:li:sponsoredCampaignGroup:999',
        name: 'Budgeted Group',
        status: 'ACTIVE',
      });

      await createCampaignGroup(
        { accountId: '456', name: 'Budgeted Group', totalBudget: 5000 },
        mockClient
      );

      expect(mockClient.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          totalBudget: { amount: '5000', currencyCode: 'USD' },
        })
      );
    });

    it('includes run schedule when dates provided', async () => {
      vi.mocked(mockClient.create).mockResolvedValue({
        id: 'urn:li:sponsoredCampaignGroup:999',
        name: 'Scheduled Group',
        status: 'ACTIVE',
      });

      await createCampaignGroup(
        {
          accountId: '456',
          name: 'Scheduled Group',
          startDate: '2026-03-01',
          endDate: '2026-03-31',
        },
        mockClient
      );

      expect(mockClient.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          runSchedule: {
            start: expect.any(Number),
            end: expect.any(Number),
          },
        })
      );
    });
  });

  describe('updateCampaignGroup', () => {
    it('updates campaign group status', async () => {
      vi.mocked(mockClient.partialUpdate).mockResolvedValue(undefined);
      vi.mocked(mockClient.get).mockResolvedValue({
        id: 'urn:li:sponsoredCampaignGroup:123',
        name: 'Test Group',
        status: 'PAUSED',
      });

      const result = await updateCampaignGroup(
        { accountId: '456', groupId: '123', status: 'PAUSED' },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.partialUpdate).toHaveBeenCalledWith(
        '/adAccounts/456/adCampaignGroups',
        '123',
        { status: 'PAUSED' }
      );
      expect(parsed.message).toBe('Campaign group updated successfully');
    });

    it('updates multiple fields', async () => {
      vi.mocked(mockClient.partialUpdate).mockResolvedValue(undefined);
      vi.mocked(mockClient.get).mockResolvedValue({
        id: 'urn:li:sponsoredCampaignGroup:123',
        name: 'Updated Name',
        status: 'ACTIVE',
      });

      await updateCampaignGroup(
        {
          accountId: '456',
          groupId: '123',
          name: 'Updated Name',
          totalBudget: 2000,
          endDate: '2026-06-30',
        },
        mockClient
      );

      expect(mockClient.partialUpdate).toHaveBeenCalledWith(
        '/adAccounts/456/adCampaignGroups',
        '123',
        {
          name: 'Updated Name',
          totalBudget: { amount: '2000', currencyCode: 'USD' },
          'runSchedule.end': expect.any(Number),
        }
      );
    });
  });

  describe('tool definitions', () => {
    it('exports correct tool structure', () => {
      expect(campaignGroupTools).toHaveProperty('list_campaign_groups');
      expect(campaignGroupTools).toHaveProperty('create_campaign_group');
      expect(campaignGroupTools).toHaveProperty('update_campaign_group');

      for (const tool of Object.values(campaignGroupTools)) {
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(tool).toHaveProperty('handler');
      }
    });
  });
});
