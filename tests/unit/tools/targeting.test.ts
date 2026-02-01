import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listTargetingFacets,
  searchTargetingEntities,
  estimateAudience,
  targetingTools,
} from '../../../src/tools/targeting.js';
import type { LinkedInClient } from '../../../src/client.js';

/**
 * Tests for targeting tool handlers.
 */

describe('Targeting Tools', () => {
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

  describe('listTargetingFacets', () => {
    it('lists available targeting facets', async () => {
      const mockResponse = {
        elements: [
          {
            name: 'Locations',
            urn: 'urn:li:adTargetingFacet:locations',
            availableEntityFinders: ['typeahead'],
          },
          {
            name: 'Industries',
            urn: 'urn:li:adTargetingFacet:industries',
            availableEntityFinders: ['typeahead', 'browse'],
          },
        ],
      };
      vi.mocked(mockClient.getAll).mockResolvedValue(mockResponse);

      const result = await listTargetingFacets({}, mockClient);
      const parsed = JSON.parse(result);

      expect(mockClient.getAll).toHaveBeenCalledWith('/adTargetingFacets');
      expect(parsed.count).toBe(2);
      expect(parsed.facets[0]).toEqual({
        name: 'Locations',
        urn: 'urn:li:adTargetingFacet:locations',
        availableFinders: ['typeahead'],
      });
    });
  });

  describe('searchTargetingEntities', () => {
    it('searches for targeting entities with query', async () => {
      const mockResponse = {
        elements: [
          {
            urn: 'urn:li:geo:103644278',
            name: 'United States',
            facetUrn: 'urn:li:adTargetingFacet:locations',
          },
        ],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await searchTargetingEntities(
        { facet: 'locations', query: 'United States' },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adTargetingEntities',
        'adTargetingFacet',
        expect.objectContaining({
          facet: 'urn:li:adTargetingFacet:locations',
          query: 'United States',
          queryVersion: 'QUERY_USES_URNS',
          count: 20,
        })
      );
      expect(parsed.count).toBe(1);
      expect(parsed.entities[0].name).toBe('United States');
    });

    it('searches without query (browse mode)', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      await searchTargetingEntities(
        { facet: 'industries', limit: 50 },
        mockClient
      );

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adTargetingEntities',
        'adTargetingFacet',
        expect.objectContaining({
          facet: 'urn:li:adTargetingFacet:industries',
          count: 50,
        })
      );
    });

    it('rejects unknown facet type via Zod schema validation', async () => {
      // The Zod schema validates facet against a fixed enum before the handler runs.
      // This test explicitly verifies schema-level rejection with the expected error message.
      await expect(
        searchTargetingEntities(
          { facet: 'unknown' as never, query: 'test' },
          mockClient
        )
      ).rejects.toThrow(/Invalid enum value/);

      // Verify the handler never called the API since validation failed
      expect(mockClient.finder).not.toHaveBeenCalled();
    });

    it('maps companies to employers facet', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      await searchTargetingEntities(
        { facet: 'companies', query: 'Google' },
        mockClient
      );

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/adTargetingEntities',
        'adTargetingFacet',
        expect.objectContaining({
          facet: 'urn:li:adTargetingFacet:employers',
        })
      );
    });
  });

  describe('estimateAudience', () => {
    it('estimates audience with required locations', async () => {
      const mockResponse = {
        elements: [{ total: 5000000, active: 1000000 }],
      };
      vi.mocked(mockClient.finder).mockResolvedValue(mockResponse);

      const result = await estimateAudience(
        {
          accountId: '456',
          includedLocations: ['urn:li:geo:103644278'],
        },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/audienceCounts',
        'targetingCriteria',
        expect.objectContaining({
          'target.includedTargetingFacets.locations': ['urn:li:geo:103644278'],
        })
      );
      expect(parsed.audienceSize.total).toBe(5000000);
      expect(parsed.audienceSize.active).toBe(1000000);
      expect(parsed.audienceSize.meetsMinimum).toBe(true);
      expect(parsed.note).toBeUndefined();
    });

    it('includes optional targeting facets', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({
        elements: [{ total: 10000, active: 5000 }],
      });

      await estimateAudience(
        {
          accountId: '456',
          includedLocations: ['urn:li:geo:103644278'],
          includedIndustries: ['urn:li:industry:1'],
          includedSeniorities: ['urn:li:seniority:5'],
          includedJobFunctions: ['urn:li:function:10'],
          excludedSeniorities: ['urn:li:seniority:1'],
        },
        mockClient
      );

      expect(mockClient.finder).toHaveBeenCalledWith(
        '/audienceCounts',
        'targetingCriteria',
        expect.objectContaining({
          'target.includedTargetingFacets.locations': ['urn:li:geo:103644278'],
          'target.includedTargetingFacets.industries': ['urn:li:industry:1'],
          'target.includedTargetingFacets.seniorities': ['urn:li:seniority:5'],
          'target.includedTargetingFacets.jobFunctions': ['urn:li:function:10'],
          'target.excludingTargetingFacets.seniorities': ['urn:li:seniority:1'],
        })
      );
    });

    it('warns when audience is below minimum', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({
        elements: [{ total: 200, active: 100 }],
      });

      const result = await estimateAudience(
        {
          accountId: '456',
          includedLocations: ['urn:li:geo:123'],
        },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(parsed.audienceSize.meetsMinimum).toBe(false);
      expect(parsed.note).toContain('minimum audience of 300');
    });

    it('handles empty response', async () => {
      vi.mocked(mockClient.finder).mockResolvedValue({ elements: [] });

      const result = await estimateAudience(
        {
          accountId: '456',
          includedLocations: ['urn:li:geo:123'],
        },
        mockClient
      );
      const parsed = JSON.parse(result);

      expect(parsed.audienceSize.total).toBe(0);
      expect(parsed.audienceSize.active).toBe(0);
    });
  });

  describe('tool definitions', () => {
    it('exports correct tool structure', () => {
      expect(targetingTools).toHaveProperty('list_targeting_facets');
      expect(targetingTools).toHaveProperty('search_targeting_entities');
      expect(targetingTools).toHaveProperty('estimate_audience');

      for (const tool of Object.values(targetingTools)) {
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(tool).toHaveProperty('handler');
      }
    });
  });
});
