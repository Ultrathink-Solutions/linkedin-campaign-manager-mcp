import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listCreatives,
  getCreative,
  createCreative,
  updateCreative,
  deleteCreative,
  creativeTools,
} from '../../../src/tools/creatives.js';
import type { LinkedInClient } from '../../../src/client.js';

/**
 * Tests for creative tool handlers.
 */

describe('Creative Tools', () => {
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

  describe('listCreatives', () => {
    it('lists creatives for an account', async () => {
      const mockResponse = {
        elements: [
          {
            id: 'urn:li:sponsoredCreative:111',
            campaign: 'urn:li:sponsoredCampaign:456',
            type: 'TEXT_AD',
            status: 'ACTIVE',
            variables: {
              data: {
                'com.linkedin.ads.TextAdCreativeVariables': {
                  title: 'Ad Title',
                  text: 'Ad copy',
                },
              },
            },
          },
        ],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await listCreatives({ accountId: '789' }, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adAccounts/789/creatives',
        'search',
        {}
      );
      expect(parsed.count).toBe(1);
      expect(parsed.creatives[0].id).toBe('111');
      expect(parsed.creatives[0].type).toBe('TEXT_AD');
    });

    it('filters by campaign when provided', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      await listCreatives({ accountId: '789', campaignId: '456' }, mockClient);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adAccounts/789/creatives',
        'search',
        { 'search.campaign.values[0]': 'urn:li:sponsoredCampaign:456' }
      );
    });

    it('ignores empty campaignId string', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      await listCreatives({ accountId: '789', campaignId: '  ' }, mockClient);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adAccounts/789/creatives',
        'search',
        {}
      );
    });
  });

  describe('getCreative', () => {
    it('gets a specific creative by ID', async () => {
      const mockResponse = {
        id: 'urn:li:sponsoredCreative:123',
        campaign: 'urn:li:sponsoredCampaign:456',
        type: 'SPONSORED_STATUS_UPDATE',
        status: 'ACTIVE',
      };
      vi.mocked(mockClient.get).mockResolvedValue(mockResponse);

      const result = await getCreative(
        { accountId: '789', creativeId: '123' },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.get).toHaveBeenCalledWith('/adAccounts/789/creatives', '123');
      expect(parsed.id).toBe('123');
      expect(parsed.type).toBe('SPONSORED_STATUS_UPDATE');
    });
  });

  describe('createCreative', () => {
    it('creates a TEXT_AD creative', async () => {
      const mockResponse = {
        id: 'urn:li:sponsoredCreative:999',
        campaign: 'urn:li:sponsoredCampaign:456',
        type: 'TEXT_AD',
        status: 'ACTIVE',
      };
      vi.mocked(mockClient.create).mockResolvedValue(mockResponse);

      const result = await createCreative(
        {
          accountId: '789',
          campaignId: '456',
          type: 'TEXT_AD',
          title: 'Click Here',
          text: 'Amazing offer!',
          destinationUrl: 'https://example.com',
        },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.create).toHaveBeenCalledWith(
        '/adAccounts/789/creatives',
        expect.objectContaining({
          campaign: 'urn:li:sponsoredCampaign:456',
          type: 'TEXT_AD',
          status: 'ACTIVE',
          variables: {
            clickUri: 'https://example.com',
            data: {
              'com.linkedin.ads.TextAdCreativeVariables': {
                title: 'Click Here',
                text: 'Amazing offer!',
              },
            },
          },
        })
      );
      expect(parsed.message).toBe('Creative created successfully');
    });

    it('throws error for TEXT_AD without title', async () => {
      await expect(
        createCreative(
          {
            accountId: '789',
            campaignId: '456',
            type: 'TEXT_AD',
            text: 'No title',
            destinationUrl: 'https://example.com',
          },
          mockClient
        )
      ).rejects.toThrow('Title is required for TEXT_AD creatives');
    });

    it('creates a sponsored content creative', async () => {
      const mockResponse = {
        id: 'urn:li:sponsoredCreative:888',
        campaign: 'urn:li:sponsoredCampaign:456',
        type: 'SPONSORED_STATUS_UPDATE',
        status: 'ACTIVE',
      };
      vi.mocked(mockClient.create).mockResolvedValue(mockResponse);

      await createCreative(
        {
          accountId: '789',
          campaignId: '456',
          type: 'SPONSORED_STATUS_UPDATE',
          text: 'Sponsored post content',
          destinationUrl: 'https://example.com',
          imageUrl: 'https://example.com/image.jpg',
        },
        mockClient
      );

      expect(mockClient.create).toHaveBeenCalledWith(
        '/adAccounts/789/creatives',
        expect.objectContaining({
          type: 'SPONSORED_STATUS_UPDATE',
          variables: {
            clickUri: 'https://example.com',
            data: {
              'com.linkedin.ads.SponsoredUpdateCreativeVariables': {
                activity: 'Sponsored post content',
                media: 'https://example.com/image.jpg',
              },
            },
          },
        })
      );
    });
  });

  describe('updateCreative', () => {
    it('updates creative status', async () => {
      vi.mocked(mockClient.partialUpdate).mockResolvedValue(undefined);
      vi.mocked(mockClient.get).mockResolvedValue({
        id: 'urn:li:sponsoredCreative:123',
        campaign: 'urn:li:sponsoredCampaign:456',
        type: 'TEXT_AD',
        status: 'PAUSED',
      });

      const result = await updateCreative(
        { accountId: '789', creativeId: '123', status: 'PAUSED' },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.partialUpdate).toHaveBeenCalledWith(
        '/adAccounts/789/creatives',
        '123',
        { status: 'PAUSED' }
      );
      expect(parsed.message).toBe('Creative updated successfully');
    });

    it('updates destination URL', async () => {
      vi.mocked(mockClient.partialUpdate).mockResolvedValue(undefined);
      vi.mocked(mockClient.get).mockResolvedValue({
        id: 'urn:li:sponsoredCreative:123',
        campaign: 'urn:li:sponsoredCampaign:456',
        type: 'TEXT_AD',
        status: 'ACTIVE',
      });

      await updateCreative(
        {
          accountId: '789',
          creativeId: '123',
          destinationUrl: 'https://new-url.com',
        },
        mockClient
      );

      expect(mockClient.partialUpdate).toHaveBeenCalledWith(
        '/adAccounts/789/creatives',
        '123',
        { 'variables.clickUri': 'https://new-url.com' }
      );
    });
  });

  describe('deleteCreative', () => {
    it('deletes a creative', async () => {
      vi.mocked(mockClient.delete).mockResolvedValue(undefined);

      const result = await deleteCreative(
        { accountId: '789', creativeId: '123' },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.delete).toHaveBeenCalledWith('/adAccounts/789/creatives', '123');
      expect(parsed.message).toBe('Creative deleted successfully');
      expect(parsed.creativeId).toBe('123');
    });
  });

  describe('tool definitions', () => {
    it('exports correct tool structure', () => {
      expect(creativeTools).toHaveProperty('list_creatives');
      expect(creativeTools).toHaveProperty('get_creative');
      expect(creativeTools).toHaveProperty('create_creative');
      expect(creativeTools).toHaveProperty('update_creative');
      expect(creativeTools).toHaveProperty('delete_creative');

      for (const tool of Object.values(creativeTools)) {
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(tool).toHaveProperty('handler');
      }
    });
  });
});
