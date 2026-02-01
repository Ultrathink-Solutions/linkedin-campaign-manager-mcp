import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  campaignTools,
} from '../../../src/tools/campaigns.js';
import type { LinkedInClient } from '../../../src/client.js';

/**
 * Tests for campaign tool handlers.
 *
 * These tests verify input validation via Zod schemas and correct
 * transformation of LinkedIn API responses to our output format.
 */

describe('Campaign Tools', () => {
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

  describe('listCampaigns', () => {
    it('lists campaigns for an account', async () => {
      const mockResponse = {
        elements: [
          {
            id: 'urn:li:sponsoredCampaign:123',
            name: 'Test Campaign',
            status: 'ACTIVE',
            objectiveType: 'WEBSITE_VISITS',
            costType: 'CPC',
            dailyBudget: { amount: '50', currencyCode: 'USD' },
          },
        ],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await listCampaigns({ accountId: '456' }, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adAccounts/456/adCampaigns',
        'search',
        {}
      );
      expect(parsed.count).toBe(1);
      expect(parsed.campaigns[0]).toEqual({
        id: '123',
        name: 'Test Campaign',
        status: 'ACTIVE',
        objectiveType: 'WEBSITE_VISITS',
        costType: 'CPC',
        dailyBudget: { amount: '50', currencyCode: 'USD' },
      });
    });

    it('filters by status when provided', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      await listCampaigns({ accountId: '456', status: 'PAUSED' }, mockClient);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adAccounts/456/adCampaigns',
        'search',
        { 'search.status.values[0]': 'PAUSED' }
      );
    });

    it('filters by campaign group when provided', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      await listCampaigns({ accountId: '456', campaignGroupId: '789' }, mockClient);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adAccounts/456/adCampaigns',
        'search',
        { 'search.campaignGroup.values[0]': 'urn:li:sponsoredCampaignGroup:789' }
      );
    });

    it('rejects invalid input', async () => {
      await expect(listCampaigns({}, mockClient)).rejects.toThrow();
    });
  });

  describe('getCampaign', () => {
    it('gets a specific campaign by ID', async () => {
      const mockResponse = {
        id: 'urn:li:sponsoredCampaign:123',
        name: 'My Campaign',
        status: 'ACTIVE',
        objectiveType: 'BRAND_AWARENESS',
        costType: 'CPM',
      };
      vi.mocked(mockClient.get).mockResolvedValue(mockResponse);

      const result = await getCampaign({ accountId: '456', campaignId: '123' }, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/adAccounts/456/adCampaigns', '123');
      expect(parsed.id).toBe('123');
      expect(parsed.name).toBe('My Campaign');
    });

    it('rejects missing campaignId', async () => {
      await expect(getCampaign({ accountId: '456' }, mockClient)).rejects.toThrow();
    });
  });

  describe('createCampaign', () => {
    it('creates a campaign with required fields', async () => {
      const mockResponse = {
        id: 'urn:li:sponsoredCampaign:999',
        name: 'New Campaign',
        status: 'DRAFT',
        objectiveType: 'WEBSITE_VISITS',
        costType: 'CPC',
      };
      vi.mocked(mockClient.create).mockResolvedValue(mockResponse);

      const input = {
        accountId: '456',
        name: 'New Campaign',
        objectiveType: 'WEBSITE_VISITS',
        dailyBudget: 100,
        costType: 'CPC',
      };

      const result = await createCampaign(input, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.create).toHaveBeenCalledWith(
        '/adAccounts/456/adCampaigns',
        expect.objectContaining({
          account: 'urn:li:sponsoredAccount:456',
          name: 'New Campaign',
          objectiveType: 'WEBSITE_VISITS',
          costType: 'CPC',
          dailyBudget: { amount: '100', currencyCode: 'USD' },
          status: 'DRAFT',
          type: 'SPONSORED_UPDATES',
        })
      );
      expect(parsed.message).toBe('Campaign created successfully');
      expect(parsed.campaign.id).toBe('999');
    });

    it('includes campaign group when provided', async () => {
      vi.mocked(mockClient.create).mockResolvedValue({
        id: 'urn:li:sponsoredCampaign:999',
        name: 'Test',
        status: 'DRAFT',
        objectiveType: 'WEBSITE_VISITS',
        costType: 'CPC',
      });

      await createCampaign(
        {
          accountId: '456',
          name: 'Test',
          objectiveType: 'WEBSITE_VISITS',
          dailyBudget: 50,
          costType: 'CPC',
          campaignGroupId: '789',
        },
        mockClient
      );

      expect(mockClient.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          campaignGroup: 'urn:li:sponsoredCampaignGroup:789',
        })
      );
    });

    it('includes run schedule when dates provided', async () => {
      vi.mocked(mockClient.create).mockResolvedValue({
        id: 'urn:li:sponsoredCampaign:999',
        name: 'Test',
        status: 'DRAFT',
        objectiveType: 'WEBSITE_VISITS',
        costType: 'CPC',
      });

      await createCampaign(
        {
          accountId: '456',
          name: 'Test',
          objectiveType: 'WEBSITE_VISITS',
          dailyBudget: 50,
          costType: 'CPC',
          startDate: '2026-02-01',
          endDate: '2026-02-28',
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

    it('rejects invalid objective type', async () => {
      await expect(
        createCampaign(
          {
            accountId: '456',
            name: 'Test',
            objectiveType: 'INVALID_TYPE',
            dailyBudget: 50,
            costType: 'CPC',
          },
          mockClient
        )
      ).rejects.toThrow();
    });

    it('rejects negative daily budget', async () => {
      await expect(
        createCampaign(
          {
            accountId: '456',
            name: 'Test',
            objectiveType: 'WEBSITE_VISITS',
            dailyBudget: -50,
            costType: 'CPC',
          },
          mockClient
        )
      ).rejects.toThrow();
    });
  });

  describe('updateCampaign', () => {
    it('updates campaign status', async () => {
      vi.mocked(mockClient.partialUpdate).mockResolvedValue(undefined);
      vi.mocked(mockClient.get).mockResolvedValue({
        id: 'urn:li:sponsoredCampaign:123',
        name: 'Test',
        status: 'PAUSED',
        objectiveType: 'WEBSITE_VISITS',
        costType: 'CPC',
      });

      const result = await updateCampaign(
        { accountId: '456', campaignId: '123', status: 'PAUSED' },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.partialUpdate).toHaveBeenCalledWith(
        '/adAccounts/456/adCampaigns',
        '123',
        { status: 'PAUSED' }
      );
      expect(parsed.message).toBe('Campaign updated successfully');
      expect(parsed.campaign.status).toBe('PAUSED');
    });

    it('updates multiple fields', async () => {
      vi.mocked(mockClient.partialUpdate).mockResolvedValue(undefined);
      vi.mocked(mockClient.get).mockResolvedValue({
        id: 'urn:li:sponsoredCampaign:123',
        name: 'Updated Name',
        status: 'ACTIVE',
        objectiveType: 'WEBSITE_VISITS',
        costType: 'CPC',
      });

      await updateCampaign(
        {
          accountId: '456',
          campaignId: '123',
          name: 'Updated Name',
          dailyBudget: 200,
        },
        mockClient
      );

      expect(mockClient.partialUpdate).toHaveBeenCalledWith(
        '/adAccounts/456/adCampaigns',
        '123',
        {
          name: 'Updated Name',
          dailyBudget: { amount: '200', currencyCode: 'USD' },
        }
      );
    });

    it('updates end date with nested path', async () => {
      vi.mocked(mockClient.partialUpdate).mockResolvedValue(undefined);
      vi.mocked(mockClient.get).mockResolvedValue({
        id: 'urn:li:sponsoredCampaign:123',
        name: 'Test',
        status: 'ACTIVE',
        objectiveType: 'WEBSITE_VISITS',
        costType: 'CPC',
      });

      await updateCampaign(
        { accountId: '456', campaignId: '123', endDate: '2026-03-31' },
        mockClient
      );

      expect(mockClient.partialUpdate).toHaveBeenCalledWith(
        '/adAccounts/456/adCampaigns',
        '123',
        { 'runSchedule.end': expect.any(Number) }
      );
    });
  });

  describe('deleteCampaign', () => {
    it('archives a campaign (soft delete)', async () => {
      vi.mocked(mockClient.partialUpdate).mockResolvedValue(undefined);

      const result = await deleteCampaign({ accountId: '456', campaignId: '123' }, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.partialUpdate).toHaveBeenCalledWith(
        '/adAccounts/456/adCampaigns',
        '123',
        { status: 'ARCHIVED' }
      );
      expect(parsed.message).toBe('Campaign archived successfully');
      expect(parsed.campaignId).toBe('123');
    });
  });

  describe('tool definitions', () => {
    it('exports correct tool structure', () => {
      expect(campaignTools).toHaveProperty('list_campaigns');
      expect(campaignTools).toHaveProperty('get_campaign');
      expect(campaignTools).toHaveProperty('create_campaign');
      expect(campaignTools).toHaveProperty('update_campaign');
      expect(campaignTools).toHaveProperty('delete_campaign');

      // Each tool should have description, parameters, and handler
      for (const tool of Object.values(campaignTools)) {
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(tool).toHaveProperty('handler');
        expect(typeof tool.handler).toBe('function');
      }
    });
  });
});
