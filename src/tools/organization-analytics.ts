import { z } from 'zod';
import type { LinkedInClient } from '../client.js';
import { ValidationError } from '../errors.js';
import {
  GetShareStatisticsInputSchema,
  GetFollowerStatisticsInputSchema,
  GetOrganizationInputSchema,
  type ShareStatistics,
  type FollowerStatistics,
  type OrganizationSummary,
} from '../types.js';
import { buildUrn, dateToEpochMs, epochMsToIso } from '../utils/formatters.js';

// ============================================================================
// Zod Schemas for LinkedIn API Response Validation
// ============================================================================

/**
 * Schema for totalShareStatistics from LinkedIn API
 */
const TotalShareStatisticsSchema = z.object({
  impressionCount: z.number().optional(),
  uniqueImpressionsCount: z.number().optional(),
  clickCount: z.number().optional(),
  likeCount: z.number().optional(),
  commentCount: z.number().optional(),
  shareCount: z.number().optional(),
  engagement: z.number().optional(),
});

/**
 * Schema for share statistics element from LinkedIn API
 */
const ShareStatisticsElementSchema = z.object({
  totalShareStatistics: TotalShareStatisticsSchema.optional(),
});

/**
 * Schema for follower counts from LinkedIn API
 */
const FollowerCountsSchema = z.object({
  organicFollowerCount: z.number().optional(),
  paidFollowerCount: z.number().optional(),
});

/**
 * Schema for demographic item from LinkedIn API
 */
const DemographicItemSchema = z.object({
  function: z.string().optional(),
  seniority: z.string().optional(),
  industry: z.string().optional(),
  geo: z.string().optional(),
  staffCountRange: z.string().optional(),
  followerCounts: FollowerCountsSchema.optional(),
});

/**
 * Schema for follower statistics element from LinkedIn API
 */
const FollowerStatisticsElementSchema = z.object({
  followerCounts: FollowerCountsSchema.optional(),
  followerCountsByFunction: z.array(DemographicItemSchema).optional(),
  followerCountsBySeniority: z.array(DemographicItemSchema).optional(),
  followerCountsByIndustry: z.array(DemographicItemSchema).optional(),
  followerCountsByGeoCountry: z.array(DemographicItemSchema).optional(),
  followerCountsByStaffCountRange: z.array(DemographicItemSchema).optional(),
});

/**
 * Get share/post statistics for an organization.
 * Returns engagement metrics: impressions, clicks, likes, comments, shares.
 * Requires Community Management API with rw_organization_admin scope.
 */
export async function getShareStatistics(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { organizationId, startDate, granularity, endDate: rawEndDate } = GetShareStatisticsInputSchema.parse(input);

  // Normalize empty endDate to undefined for consistent handling
  const endDate = rawEndDate === '' ? undefined : rawEndDate;

  const organizationUrn = buildUrn('organization', organizationId);

  // Compute normalized end date/ms once for both query and response
  const normalizedEndDate = endDate ?? epochMsToIso(Date.now());
  const normalizedEndMs = endDate !== undefined ? dateToEpochMs(endDate) : Date.now();

  const queryParams: Record<string, unknown> = {
    q: 'organizationalEntity',
    organizationalEntity: organizationUrn,
  };

  // Add time range if specified
  if (startDate !== undefined && startDate !== '') {
    const startMs = dateToEpochMs(startDate);

    queryParams.timeIntervals = {
      timeRange: {
        start: startMs,
        end: normalizedEndMs,
      },
      timeGranularityType: granularity,
    };
  }

  const response = await client.finder<{ elements?: Record<string, unknown>[] }>(
    '/organizationalEntityShareStatistics',
    'organizationalEntity',
    queryParams
  );

  // Handle empty or missing elements array
  const elements = response.elements ?? [];
  const hasData = elements.length > 0;
  const rawStats = elements[0];

  // Validate the response element with Zod schema
  let validated: z.infer<typeof ShareStatisticsElementSchema> = {};
  if (rawStats !== undefined) {
    const parseResult = ShareStatisticsElementSchema.safeParse(rawStats);
    if (!parseResult.success) {
      throw new ValidationError(
        `Invalid share statistics response for organization ${organizationId}: ${parseResult.error.message}`,
        'shareStatisticsResponse',
        parseResult.error.issues
      );
    }
    validated = parseResult.data;
  }
  const totalStats = validated.totalShareStatistics;

  const result: ShareStatistics = {
    organizationId,
    dataAvailable: hasData,
    totalStats: {
      impressions: totalStats?.impressionCount ?? 0,
      uniqueImpressions: totalStats?.uniqueImpressionsCount ?? 0,
      clicks: totalStats?.clickCount ?? 0,
      likes: totalStats?.likeCount ?? 0,
      comments: totalStats?.commentCount ?? 0,
      shares: totalStats?.shareCount ?? 0,
      engagement: totalStats?.engagement ?? 0,
    },
  };

  // Add time range if queried with dates
  if (startDate !== undefined && startDate !== '') {
    result.timeRange = {
      start: startDate,
      end: normalizedEndDate,
    };
  }

  return JSON.stringify(result, null, 2);
}

/**
 * Get follower statistics for an organization.
 * Returns follower counts and demographics.
 * Requires Community Management API with rw_organization_admin scope.
 */
export async function getFollowerStatistics(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { organizationId, startDate, granularity, endDate: rawEndDate } = GetFollowerStatisticsInputSchema.parse(input);

  // Normalize empty endDate to undefined for consistent handling
  const endDate = rawEndDate === '' ? undefined : rawEndDate;

  const organizationUrn = buildUrn('organization', organizationId);

  // Compute normalized end date/ms once for both query and response
  const normalizedEndDate = endDate ?? epochMsToIso(Date.now());
  const normalizedEndMs = endDate !== undefined ? dateToEpochMs(endDate) : Date.now();

  const queryParams: Record<string, unknown> = {
    q: 'organizationalEntity',
    organizationalEntity: organizationUrn,
  };

  // Add time range if specified
  if (startDate !== undefined && startDate !== '') {
    const startMs = dateToEpochMs(startDate);

    queryParams.timeIntervals = {
      timeRange: {
        start: startMs,
        end: normalizedEndMs,
      },
      timeGranularityType: granularity,
    };
  }

  const response = await client.finder<{ elements?: Record<string, unknown>[] }>(
    '/organizationalEntityFollowerStatistics',
    'organizationalEntity',
    queryParams
  );

  // Handle empty or missing elements array
  const elements = response.elements ?? [];
  const hasData = elements.length > 0;
  const rawStats = elements[0];

  // Validate the response element with Zod schema
  let validated: z.infer<typeof FollowerStatisticsElementSchema> = {};
  if (rawStats !== undefined) {
    const parseResult = FollowerStatisticsElementSchema.safeParse(rawStats);
    if (!parseResult.success) {
      throw new ValidationError(
        `Invalid follower statistics response for organization ${organizationId}: ${parseResult.error.message}`,
        'followerStatisticsResponse',
        parseResult.error.issues
      );
    }
    validated = parseResult.data;
  }

  // Extract follower counts from validated data
  const organicCount = validated.followerCounts?.organicFollowerCount ?? 0;
  const paidCount = validated.followerCounts?.paidFollowerCount ?? 0;

  const result: FollowerStatistics = {
    organizationId,
    dataAvailable: hasData,
    totalFollowers: organicCount + paidCount,
    organicFollowers: organicCount,
    paidFollowers: paidCount,
  };

  // Extract demographics from validated data if available
  const {
    followerCountsByFunction,
    followerCountsBySeniority,
    followerCountsByIndustry,
    followerCountsByGeoCountry,
    followerCountsByStaffCountRange,
  } = validated;

  if (
    followerCountsByFunction !== undefined ||
    followerCountsBySeniority !== undefined ||
    followerCountsByIndustry !== undefined ||
    followerCountsByGeoCountry !== undefined ||
    followerCountsByStaffCountRange !== undefined
  ) {
    result.demographics = {};

    if (followerCountsByFunction !== undefined) {
      result.demographics.byFunction = extractDemographicCounts(followerCountsByFunction);
    }
    if (followerCountsBySeniority !== undefined) {
      result.demographics.bySeniority = extractDemographicCounts(followerCountsBySeniority);
    }
    if (followerCountsByIndustry !== undefined) {
      result.demographics.byIndustry = extractDemographicCounts(followerCountsByIndustry);
    }
    if (followerCountsByGeoCountry !== undefined) {
      result.demographics.byLocation = extractDemographicCounts(followerCountsByGeoCountry);
    }
    if (followerCountsByStaffCountRange !== undefined) {
      result.demographics.byCompanySize = extractDemographicCounts(followerCountsByStaffCountRange);
    }
  }

  // Add time range if queried with dates
  if (startDate !== undefined && startDate !== '') {
    result.timeRange = {
      start: startDate,
      end: normalizedEndDate,
    };
  }

  return JSON.stringify(result, null, 2);
}

/**
 * Zod schema for validating LinkedIn organization API response
 */
const LinkedInOrganizationResponseSchema = z.object({
  localizedName: z.string().optional(),
  name: z.string().optional(),
  vanityName: z.string().optional(),
  localizedDescription: z.string().optional(),
  localizedWebsite: z.string().optional(),
  industries: z.array(z.string()).optional(),
  localizedSpecialties: z.array(z.string()).optional(),
  staffCountRange: z.string().optional(),
  logoV2: z.object({
    original: z.string().optional(),
  }).optional(),
});

/**
 * Get organization/company page details.
 * Requires Community Management API with rw_organization_admin scope.
 */
export async function getOrganization(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { organizationId } = GetOrganizationInputSchema.parse(input);

  const response = await client.get<Record<string, unknown>>('/organizations', organizationId);

  // Validate the API response with Zod schema
  const parseResult = LinkedInOrganizationResponseSchema.safeParse(response);

  if (!parseResult.success) {
    throw new ValidationError(
      `Invalid organization response for ${organizationId}: ${parseResult.error.message}`,
      'organizationResponse',
      parseResult.error.issues
    );
  }

  const validated = parseResult.data;

  // Extract logo URL from validated response
  const originalImage = validated.logoV2?.original;

  // Extract industries (array of URNs like "urn:li:industry:4")
  const industries = validated.industries?.map((urn) => urn.split(':').pop() ?? urn);

  const result: OrganizationSummary = {
    id: organizationId,
    name: validated.localizedName ?? validated.name ?? '',
    vanityName: validated.vanityName,
    description: validated.localizedDescription,
    websiteUrl: validated.localizedWebsite,
    industries,
    specialties: validated.localizedSpecialties,
    staffCount: validated.staffCountRange,
    logoUrl: originalImage,
  };

  return JSON.stringify(result, null, 2);
}

/**
 * Helper to extract demographic counts from LinkedIn's format.
 * Uses defensive type checking to handle unexpected data shapes.
 */
function extractDemographicCounts(items: z.infer<typeof DemographicItemSchema>[]): Record<string, number> {
  const result: Record<string, number> = {};

  for (const item of items) {
    // Defensively determine the key by checking each field's type
    let key = 'unknown';
    if (typeof item.function === 'string' && item.function !== '') {
      key = item.function;
    } else if (typeof item.seniority === 'string' && item.seniority !== '') {
      key = item.seniority;
    } else if (typeof item.industry === 'string' && item.industry !== '') {
      key = item.industry;
    } else if (typeof item.geo === 'string' && item.geo !== '') {
      key = item.geo;
    } else if (typeof item.staffCountRange === 'string' && item.staffCountRange !== '') {
      key = item.staffCountRange;
    }

    // Defensively extract follower counts with type checking
    const followerCounts = item.followerCounts;
    const organicCount = typeof followerCounts?.organicFollowerCount === 'number'
      ? followerCounts.organicFollowerCount
      : 0;
    const paidCount = typeof followerCounts?.paidFollowerCount === 'number'
      ? followerCounts.paidFollowerCount
      : 0;
    const count = organicCount + paidCount;

    // Extract readable name from URN if present (only if key is a string)
    const readableKey = typeof key === 'string' && key.includes('urn:')
      ? key.split(':').pop() ?? key
      : key;

    // Aggregate counts for the same key instead of overwriting
    result[readableKey] = (result[readableKey] ?? 0) + count;
  }

  return result;
}

/**
 * Tool definitions for registration with FastMCP.
 * Note: These tools require the LINKEDIN_COMMUNITY_TOKEN environment variable
 * which must be from the Community Management API app (separate from the Ads app).
 */
export const organizationAnalyticsTools = {
  get_share_statistics: {
    description:
      'Get engagement statistics for an organization\'s posts: impressions, clicks, likes, comments, shares. Requires Community Management API access (separate app with rw_organization_admin scope).',
    parameters: GetShareStatisticsInputSchema,
    handler: getShareStatistics,
  },
  get_follower_statistics: {
    description:
      'Get follower statistics for an organization: total followers, organic vs paid, and demographic breakdowns (job function, seniority, industry, location, company size). Requires Community Management API access.',
    parameters: GetFollowerStatisticsInputSchema,
    handler: getFollowerStatistics,
  },
  get_organization: {
    description:
      'Get details about a LinkedIn organization/company page: name, vanity name, description, website, industries array, specialties array, staff count range, logo URL. Requires Community Management API access.',
    parameters: GetOrganizationInputSchema,
    handler: getOrganization,
  },
};
