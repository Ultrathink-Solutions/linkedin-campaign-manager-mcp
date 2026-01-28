import type { LinkedInClient } from '../client.js';
import {
  ListTargetingFacetsInputSchema,
  SearchTargetingEntitiesInputSchema,
  EstimateAudienceInputSchema,
} from '../types.js';

/**
 * Mapping from user-friendly facet names to LinkedIn API facet URNs
 */
const FACET_MAPPING: Record<string, string> = {
  locations: 'urn:li:adTargetingFacet:locations',
  industries: 'urn:li:adTargetingFacet:industries',
  seniorities: 'urn:li:adTargetingFacet:seniorities',
  jobFunctions: 'urn:li:adTargetingFacet:jobFunctions',
  titles: 'urn:li:adTargetingFacet:titles',
  skills: 'urn:li:adTargetingFacet:skills',
  companies: 'urn:li:adTargetingFacet:employers',
  schools: 'urn:li:adTargetingFacet:schools',
};

/**
 * List available targeting facets (dimensions).
 */
export async function listTargetingFacets(
  _input: unknown,
  client: LinkedInClient
): Promise<string> {
  // Validate input (empty object expected)
  ListTargetingFacetsInputSchema.parse(_input);

  const response = await client.getAll<{ elements: Record<string, unknown>[] }>('/adTargetingFacets');

  const facets = response.elements.map((facet) => ({
    name: facet.name,
    urn: facet.urn,
    availableFinders: facet.availableEntityFinders,
  }));

  return JSON.stringify(
    {
      facets,
      count: facets.length,
    },
    null,
    2
  );
}

/**
 * Search for targeting entities within a facet.
 */
export async function searchTargetingEntities(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { facet, query, limit } = SearchTargetingEntitiesInputSchema.parse(input);

  const facetUrn = FACET_MAPPING[facet];
  if (!facetUrn) {
    throw new Error(`Unknown facet type: ${facet}. Valid types: ${Object.keys(FACET_MAPPING).join(', ')}`);
  }

  const queryParams: Record<string, unknown> = {
    facet: facetUrn,
    queryVersion: 'QUERY_USES_URNS',
    count: limit,
  };

  if (query !== undefined) {
    queryParams.query = query;
  }

  const response = await client.finder<{ elements: Record<string, unknown>[] }>(
    '/adTargetingEntities',
    'adTargetingFacet',
    queryParams
  );

  const entities = response.elements.map((entity) => ({
    urn: entity.urn,
    name: entity.name,
    facetUrn: entity.facetUrn,
  }));

  return JSON.stringify(
    {
      entities,
      facet,
      count: entities.length,
    },
    null,
    2
  );
}

/**
 * Estimate audience size for given targeting criteria.
 */
export async function estimateAudience(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const params = EstimateAudienceInputSchema.parse(input);

  // Build targeting criteria in LinkedIn's format
  const queryParams: Record<string, unknown> = {
    'target.includedTargetingFacets.locations': params.includedLocations,
  };

  if (params.includedIndustries !== undefined && params.includedIndustries.length > 0) {
    queryParams['target.includedTargetingFacets.industries'] = params.includedIndustries;
  }

  if (params.includedSeniorities !== undefined && params.includedSeniorities.length > 0) {
    queryParams['target.includedTargetingFacets.seniorities'] = params.includedSeniorities;
  }

  if (params.includedJobFunctions !== undefined && params.includedJobFunctions.length > 0) {
    queryParams['target.includedTargetingFacets.jobFunctions'] = params.includedJobFunctions;
  }

  if (params.excludedSeniorities !== undefined && params.excludedSeniorities.length > 0) {
    queryParams['target.excludingTargetingFacets.seniorities'] = params.excludedSeniorities;
  }

  const response = await client.finder<{ elements: Array<{ total: number; active: number }> }>(
    '/audienceCounts',
    'targetingCriteria',
    queryParams
  );

  const counts = response.elements[0] ?? { total: 0, active: 0 };

  return JSON.stringify(
    {
      audienceSize: {
        total: counts.total,
        active: counts.active,
        meetsMinimum: counts.total >= 300,
      },
      note: counts.total < 300
        ? 'LinkedIn requires a minimum audience of 300 members for campaigns'
        : undefined,
    },
    null,
    2
  );
}

/**
 * Tool definitions for registration with FastMCP
 */
export const targetingTools = {
  list_targeting_facets: {
    description: 'List available LinkedIn targeting dimensions (locations, industries, seniorities, etc.)',
    parameters: ListTargetingFacetsInputSchema,
    handler: listTargetingFacets,
  },
  search_targeting_entities: {
    description: 'Search for specific targeting values within a facet (e.g., search for locations, job titles)',
    parameters: SearchTargetingEntitiesInputSchema,
    handler: searchTargetingEntities,
  },
  estimate_audience: {
    description: 'Estimate the audience size for given targeting criteria',
    parameters: EstimateAudienceInputSchema,
    handler: estimateAudience,
  },
};
