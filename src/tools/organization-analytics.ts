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

  const response = await client.finder<{ elements: Record<string, unknown>[] }>(
    '/organizationalEntityShareStatistics',
    'organizationalEntity',
    queryParams
  );

  // Format the response
  const stats = response.elements[0] ?? {};
  const totalStats = stats.totalShareStatistics as Record<string, unknown> | undefined;

  const result: ShareStatistics = {
    organizationId,
    totalStats: {
      impressions: (totalStats?.impressionCount as number) ?? 0,
      uniqueImpressions: (totalStats?.uniqueImpressionsCount as number) ?? 0,
      clicks: (totalStats?.clickCount as number) ?? 0,
      likes: (totalStats?.likeCount as number) ?? 0,
      comments: (totalStats?.commentCount as number) ?? 0,
      shares: (totalStats?.shareCount as number) ?? 0,
      engagement: (totalStats?.engagement as number) ?? 0,
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

  const response = await client.finder<{ elements: Record<string, unknown>[] }>(
    '/organizationalEntityFollowerStatistics',
    'organizationalEntity',
    queryParams
  );

  const stats = response.elements[0] ?? {};

  // Extract follower counts
  const followerCounts = stats.followerCounts as Record<string, unknown> | undefined;
  const organicCount = (followerCounts?.organicFollowerCount as number) ?? 0;
  const paidCount = (followerCounts?.paidFollowerCount as number) ?? 0;

  const result: FollowerStatistics = {
    organizationId,
    totalFollowers: organicCount + paidCount,
    organicFollowers: organicCount,
    paidFollowers: paidCount,
  };

  // Extract demographics if available
  const followerCountsByFunction = stats.followerCountsByFunction as Record<string, unknown>[] | undefined;
  const followerCountsBySeniority = stats.followerCountsBySeniority as Record<string, unknown>[] | undefined;
  const followerCountsByIndustry = stats.followerCountsByIndustry as Record<string, unknown>[] | undefined;
  const followerCountsByGeoCountry = stats.followerCountsByGeoCountry as Record<string, unknown>[] | undefined;
  const followerCountsByStaffCountRange = stats.followerCountsByStaffCountRange as Record<string, unknown>[] | undefined;

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
      `Invalid organization response from LinkedIn API: ${parseResult.error.message}`,
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
 * Helper to extract demographic counts from LinkedIn's format
 */
function extractDemographicCounts(items: Record<string, unknown>[]): Record<string, number> {
  const result: Record<string, number> = {};

  for (const item of items) {
    // LinkedIn returns URNs or names as keys
    const key = (item.function as string) ??
      (item.seniority as string) ??
      (item.industry as string) ??
      (item.geo as string) ??
      (item.staffCountRange as string) ??
      'unknown';

    const followerCounts = item.followerCounts as Record<string, unknown> | undefined;
    const count = ((followerCounts?.organicFollowerCount as number) ?? 0) +
      ((followerCounts?.paidFollowerCount as number) ?? 0);

    // Extract readable name from URN if present
    const readableKey = key.includes('urn:') ? key.split(':').pop() ?? key : key;
    result[readableKey] = count;
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
      'Get details about a LinkedIn organization/company page: name, description, website, industry, staff count, logo. Requires Community Management API access.',
    parameters: GetOrganizationInputSchema,
    handler: getOrganization,
  },
};
