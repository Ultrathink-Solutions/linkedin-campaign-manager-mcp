import type { LinkedInClient } from '../client.js';
import {
  GetAnalyticsInputSchema,
  GetCampaignPerformanceInputSchema,
} from '../types.js';
import { buildUrn, dateToEpochMs } from '../utils/formatters.js';

/**
 * Default metrics to fetch if not specified
 */
const DEFAULT_METRICS = [
  'impressions',
  'clicks',
  'costInLocalCurrency',
  'externalWebsiteConversions',
  'likes',
  'shares',
  'comments',
  'follows',
];

/**
 * Get performance analytics with flexible pivoting.
 */
export async function getAnalytics(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const params = GetAnalyticsInputSchema.parse(input);

  const startEpoch = dateToEpochMs(params.startDate);
  const endEpoch = dateToEpochMs(params.endDate);

  const queryParams: Record<string, unknown> = {
    dateRange: {
      start: {
        day: new Date(startEpoch).getDate(),
        month: new Date(startEpoch).getMonth() + 1,
        year: new Date(startEpoch).getFullYear(),
      },
      end: {
        day: new Date(endEpoch).getDate(),
        month: new Date(endEpoch).getMonth() + 1,
        year: new Date(endEpoch).getFullYear(),
      },
    },
    pivot: params.pivot,
    timeGranularity: 'ALL',
    accounts: [buildUrn('sponsoredAccount', params.accountId)],
  };

  if (params.campaignIds && params.campaignIds.length > 0) {
    queryParams.campaigns = params.campaignIds.map((id) =>
      buildUrn('sponsoredCampaign', id)
    );
  }

  // Add requested metrics as fields parameter
  const metrics = params.metrics ?? DEFAULT_METRICS;
  queryParams.fields = metrics.join(',');

  const response = await client.finder<{ elements: Record<string, unknown>[] }>(
    '/adAnalytics',
    'analytics',
    queryParams
  );

  // Transform response to be more user-friendly
  const analytics = response.elements.map((element) => {
    const result: Record<string, unknown> = {};

    // Extract pivot value
    if (element.pivotValue !== undefined) {
      result.pivotValue = element.pivotValue;
    }

    // Include all metric values
    for (const metric of metrics) {
      if (metric in element) {
        result[metric] = element[metric];
      }
    }

    // Calculate derived metrics
    const impressions = element.impressions as number | undefined;
    const clicks = element.clicks as number | undefined;

    if (impressions !== undefined && clicks !== undefined && impressions > 0) {
      result.ctr = ((clicks / impressions) * 100).toFixed(2) + '%';
    }

    if (element.costInLocalCurrency !== undefined && clicks !== undefined && clicks > 0) {
      const cost = element.costInLocalCurrency as Record<string, unknown>;
      const costAmount = parseFloat(cost.amount as string);
      result.averageCpc = {
        amount: (costAmount / clicks).toFixed(2),
        currencyCode: cost.currencyCode,
      };
    }

    return result;
  });

  return JSON.stringify(
    {
      analytics,
      dateRange: {
        start: params.startDate,
        end: params.endDate,
      },
      pivot: params.pivot,
      count: analytics.length,
    },
    null,
    2
  );
}

/**
 * Convenience method to get campaign-level performance summary.
 */
export async function getCampaignPerformance(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const params = GetCampaignPerformanceInputSchema.parse(input);

  // Delegate to getAnalytics with campaign filter
  return getAnalytics(
    {
      accountId: params.accountId,
      startDate: params.startDate,
      endDate: params.endDate,
      pivot: 'CAMPAIGN',
      campaignIds: [params.campaignId],
    },
    client
  );
}

/**
 * Tool definitions for registration with FastMCP
 */
export const analyticsTools = {
  get_analytics: {
    description:
      'Get LinkedIn Ads performance analytics with flexible pivoting (by campaign, creative, account, etc.)',
    parameters: GetAnalyticsInputSchema,
    handler: getAnalytics,
  },
  get_campaign_performance: {
    description: 'Get performance summary for a specific LinkedIn campaign',
    parameters: GetCampaignPerformanceInputSchema,
    handler: getCampaignPerformance,
  },
};
