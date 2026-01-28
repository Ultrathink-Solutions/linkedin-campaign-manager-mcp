import { z } from 'zod';

// ============================================================================
// LinkedIn URN Types
// ============================================================================

/** LinkedIn URN for a sponsored account */
export type AdAccountUrn = `urn:li:sponsoredAccount:${string}`;

/** LinkedIn URN for a sponsored campaign */
export type CampaignUrn = `urn:li:sponsoredCampaign:${string}`;

/** LinkedIn URN for a sponsored campaign group */
export type CampaignGroupUrn = `urn:li:sponsoredCampaignGroup:${string}`;

/** LinkedIn URN for a creative */
export type CreativeUrn = `urn:li:sponsoredCreative:${string}`;

// ============================================================================
// Enums
// ============================================================================

export const CampaignStatus = z.enum([
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
  'CANCELED',
  'DRAFT',
  'PENDING_DELETION',
]);
export type CampaignStatus = z.infer<typeof CampaignStatus>;

export const CostType = z.enum(['CPC', 'CPM', 'CPV']);
export type CostType = z.infer<typeof CostType>;

export const ObjectiveType = z.enum([
  'BRAND_AWARENESS',
  'WEBSITE_VISITS',
  'ENGAGEMENT',
  'VIDEO_VIEWS',
  'LEAD_GENERATION',
  'WEBSITE_CONVERSIONS',
  'JOB_APPLICANTS',
  'TALENT_LEADS',
]);
export type ObjectiveType = z.infer<typeof ObjectiveType>;

export const CampaignType = z.enum([
  'TEXT_AD',
  'SPONSORED_UPDATES',
  'SPONSORED_INMAILS',
  'DYNAMIC',
]);
export type CampaignType = z.infer<typeof CampaignType>;

export const CreativeType = z.enum([
  'TEXT_AD',
  'SPONSORED_STATUS_UPDATE',
  'SPONSORED_VIDEO',
  'SPONSORED_MESSAGE',
  'CAROUSEL',
]);
export type CreativeType = z.infer<typeof CreativeType>;

export const AnalyticsPivot = z.enum([
  'ACCOUNT',
  'CAMPAIGN',
  'CAMPAIGN_GROUP',
  'CREATIVE',
  'COMPANY',
  'MEMBER_COMPANY',
  'MEMBER_COMPANY_SIZE',
  'MEMBER_COUNTRY_V2',
  'MEMBER_REGION_V2',
  'MEMBER_INDUSTRY',
  'MEMBER_JOB_FUNCTION',
  'MEMBER_JOB_TITLE',
  'MEMBER_SENIORITY',
]);
export type AnalyticsPivot = z.infer<typeof AnalyticsPivot>;

// ============================================================================
// Common Schemas
// ============================================================================

export const MoneyAmountSchema = z.object({
  amount: z.string(),
  currencyCode: z.string().length(3),
});
export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;

export const DateRangeSchema = z.object({
  start: z.number().describe('Epoch timestamp in milliseconds'),
  end: z.number().optional().describe('Epoch timestamp in milliseconds'),
});
export type DateRange = z.infer<typeof DateRangeSchema>;

// ============================================================================
// Tool Input Schemas
// ============================================================================

// Account Tools
export const ListAdAccountsInputSchema = z.object({});

export const GetAdAccountInputSchema = z.object({
  accountId: z.string().describe('The ad account ID (numeric, without URN prefix)'),
});

// Campaign Tools
export const ListCampaignsInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  status: CampaignStatus.optional().describe('Filter by campaign status'),
  campaignGroupId: z.string().optional().describe('Filter by campaign group ID'),
});

export const GetCampaignInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  campaignId: z.string().describe('The campaign ID'),
});

export const CreateCampaignInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  name: z.string().min(1).max(255).describe('Campaign name'),
  objectiveType: ObjectiveType.describe('Campaign objective'),
  campaignGroupId: z.string().optional().describe('Parent campaign group ID'),
  dailyBudget: z.number().positive().describe('Daily budget in account currency'),
  costType: CostType.describe('Billing type: CPC, CPM, or CPV'),
  startDate: z.string().optional().describe('Start date in ISO format (defaults to now)'),
  endDate: z.string().optional().describe('End date in ISO format (optional)'),
  status: z.enum(['ACTIVE', 'PAUSED', 'DRAFT']).default('DRAFT').describe('Initial status'),
});

export const UpdateCampaignInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  campaignId: z.string().describe('The campaign ID'),
  name: z.string().min(1).max(255).optional().describe('New campaign name'),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional().describe('New status'),
  dailyBudget: z.number().positive().optional().describe('New daily budget'),
  endDate: z.string().optional().describe('New end date in ISO format'),
});

export const DeleteCampaignInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  campaignId: z.string().describe('The campaign ID'),
});

// Campaign Group Tools
export const ListCampaignGroupsInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
});

export const CreateCampaignGroupInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  name: z.string().min(1).max(255).describe('Campaign group name'),
  totalBudget: z.number().positive().optional().describe('Total budget cap'),
  startDate: z.string().optional().describe('Start date in ISO format'),
  endDate: z.string().optional().describe('End date in ISO format'),
  status: z.enum(['ACTIVE', 'PAUSED']).default('ACTIVE').describe('Initial status'),
});

export const UpdateCampaignGroupInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  groupId: z.string().describe('The campaign group ID'),
  name: z.string().min(1).max(255).optional().describe('New name'),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional().describe('New status'),
  totalBudget: z.number().positive().optional().describe('New budget cap'),
  endDate: z.string().optional().describe('New end date'),
});

// Creative Tools
export const ListCreativesInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  campaignId: z.string().optional().describe('Filter by campaign ID'),
});

export const GetCreativeInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  creativeId: z.string().describe('The creative ID'),
});

export const CreateCreativeInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  campaignId: z.string().describe('Parent campaign ID'),
  type: CreativeType.describe('Creative type'),
  title: z.string().max(100).optional().describe('Ad title (required for TEXT_AD)'),
  text: z.string().max(600).describe('Ad copy/description'),
  destinationUrl: z.string().url().describe('Click-through URL'),
  imageUrl: z.string().url().optional().describe('Image URL (for sponsored content)'),
  status: z.enum(['ACTIVE', 'PAUSED']).default('ACTIVE').describe('Initial status'),
});

export const UpdateCreativeInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  creativeId: z.string().describe('The creative ID'),
  status: z.enum(['ACTIVE', 'PAUSED']).optional().describe('New status'),
  text: z.string().max(600).optional().describe('Updated ad copy'),
  destinationUrl: z.string().url().optional().describe('Updated click-through URL'),
});

export const DeleteCreativeInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  creativeId: z.string().describe('The creative ID'),
});

// Analytics Tools
export const GetAnalyticsInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  startDate: z.string().describe('Start date in YYYY-MM-DD format'),
  endDate: z.string().describe('End date in YYYY-MM-DD format'),
  pivot: AnalyticsPivot.default('CAMPAIGN').describe('Grouping dimension'),
  campaignIds: z.array(z.string()).optional().describe('Filter to specific campaign IDs'),
  metrics: z.array(z.string()).optional().describe('Specific metrics to return'),
});

export const GetCampaignPerformanceInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  campaignId: z.string().describe('The campaign ID'),
  startDate: z.string().describe('Start date in YYYY-MM-DD format'),
  endDate: z.string().describe('End date in YYYY-MM-DD format'),
});

// Targeting Tools
export const ListTargetingFacetsInputSchema = z.object({});

export const SearchTargetingEntitiesInputSchema = z.object({
  facet: z.enum([
    'locations',
    'industries',
    'seniorities',
    'jobFunctions',
    'titles',
    'skills',
    'companies',
    'schools',
  ]).describe('Targeting facet type'),
  query: z.string().optional().describe('Search term'),
  limit: z.number().min(1).max(100).default(20).describe('Max results'),
});

export const EstimateAudienceInputSchema = z.object({
  accountId: z.string().describe('The ad account ID'),
  includedLocations: z.array(z.string()).min(1).describe('Location URNs to include'),
  includedIndustries: z.array(z.string()).optional().describe('Industry URNs'),
  includedSeniorities: z.array(z.string()).optional().describe('Seniority URNs'),
  includedJobFunctions: z.array(z.string()).optional().describe('Job function URNs'),
  excludedSeniorities: z.array(z.string()).optional().describe('Seniorities to exclude'),
});

// ============================================================================
// Response Types (for our formatted responses, not raw LinkedIn API)
// ============================================================================

export interface AdAccountSummary {
  id: string;
  name: string;
  status: string;
  currency: string;
  type: string;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  objectiveType: string;
  costType: string;
  dailyBudget?: MoneyAmount;
  totalSpend?: MoneyAmount;
}

export interface CampaignGroupSummary {
  id: string;
  name: string;
  status: string;
  totalBudget?: MoneyAmount;
}

export interface CreativeSummary {
  id: string;
  campaignId: string;
  type: string;
  status: string;
  title?: string;
  text?: string;
}

export interface AnalyticsMetrics {
  impressions: number;
  clicks: number;
  spend: MoneyAmount;
  ctr: number;
  averageCpc?: MoneyAmount;
}
