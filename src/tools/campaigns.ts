import type { LinkedInClient } from '../client.js';
import {
  ListCampaignsInputSchema,
  GetCampaignInputSchema,
  CreateCampaignInputSchema,
  UpdateCampaignInputSchema,
  DeleteCampaignInputSchema,
} from '../types.js';
import { formatCampaign, buildUrn, buildMoneyAmount, dateToEpochMs } from '../utils/formatters.js';

/**
 * List campaigns for an ad account with optional filters.
 */
export async function listCampaigns(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { accountId, status, campaignGroupId } = ListCampaignsInputSchema.parse(input);

  const queryParams: Record<string, unknown> = {};

  if (status) {
    queryParams['search.status.values[0]'] = status;
  }

  if (campaignGroupId) {
    queryParams['search.campaignGroup.values[0]'] = buildUrn('sponsoredCampaignGroup', campaignGroupId);
  }

  const response = await client.finder<{ elements: Record<string, unknown>[] }>(
    `/adAccounts/${accountId}/adCampaigns`,
    'search',
    queryParams
  );

  const campaigns = response.elements.map(formatCampaign);

  return JSON.stringify(
    {
      campaigns,
      count: campaigns.length,
    },
    null,
    2
  );
}

/**
 * Get detailed information about a specific campaign.
 */
export async function getCampaign(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { accountId, campaignId } = GetCampaignInputSchema.parse(input);

  const response = await client.get<Record<string, unknown>>(
    `/adAccounts/${accountId}/adCampaigns`,
    campaignId
  );

  return JSON.stringify(formatCampaign(response), null, 2);
}

/**
 * Create a new LinkedIn ad campaign.
 */
export async function createCampaign(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const params = CreateCampaignInputSchema.parse(input);

  const entity: Record<string, unknown> = {
    account: buildUrn('sponsoredAccount', params.accountId),
    name: params.name,
    objectiveType: params.objectiveType,
    costType: params.costType,
    dailyBudget: buildMoneyAmount(params.dailyBudget),
    status: params.status,
    type: 'SPONSORED_UPDATES', // Default campaign type
  };

  if (params.campaignGroupId) {
    entity.campaignGroup = buildUrn('sponsoredCampaignGroup', params.campaignGroupId);
  }

  if (params.startDate) {
    entity.runSchedule = {
      start: dateToEpochMs(params.startDate),
      ...(params.endDate && { end: dateToEpochMs(params.endDate) }),
    };
  } else if (params.endDate) {
    entity.runSchedule = {
      start: Date.now(),
      end: dateToEpochMs(params.endDate),
    };
  }

  const response = await client.create<Record<string, unknown>>(
    `/adAccounts/${params.accountId}/adCampaigns`,
    entity
  );

  return JSON.stringify(
    {
      message: 'Campaign created successfully',
      campaign: formatCampaign(response),
    },
    null,
    2
  );
}

/**
 * Update an existing campaign.
 */
export async function updateCampaign(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { accountId, campaignId, ...updates } = UpdateCampaignInputSchema.parse(input);

  const patchSet: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    patchSet.name = updates.name;
  }

  if (updates.status !== undefined) {
    patchSet.status = updates.status;
  }

  if (updates.dailyBudget !== undefined) {
    patchSet.dailyBudget = buildMoneyAmount(updates.dailyBudget);
  }

  if (updates.endDate !== undefined) {
    // For end date, we need to do a partial update on runSchedule
    patchSet['runSchedule.end'] = dateToEpochMs(updates.endDate);
  }

  await client.partialUpdate(
    `/adAccounts/${accountId}/adCampaigns`,
    campaignId,
    patchSet
  );

  // Fetch and return the updated campaign
  const updated = await client.get<Record<string, unknown>>(
    `/adAccounts/${accountId}/adCampaigns`,
    campaignId
  );

  return JSON.stringify(
    {
      message: 'Campaign updated successfully',
      campaign: formatCampaign(updated),
    },
    null,
    2
  );
}

/**
 * Archive a campaign (LinkedIn doesn't support hard delete).
 */
export async function deleteCampaign(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { accountId, campaignId } = DeleteCampaignInputSchema.parse(input);

  // Archive by setting status to ARCHIVED
  await client.partialUpdate(
    `/adAccounts/${accountId}/adCampaigns`,
    campaignId,
    { status: 'ARCHIVED' }
  );

  return JSON.stringify(
    {
      message: 'Campaign archived successfully',
      campaignId,
    },
    null,
    2
  );
}

/**
 * Tool definitions for registration with FastMCP
 */
export const campaignTools = {
  list_campaigns: {
    description: 'List campaigns for a LinkedIn ad account with optional filters',
    parameters: ListCampaignsInputSchema,
    handler: listCampaigns,
  },
  get_campaign: {
    description: 'Get detailed information about a specific LinkedIn campaign',
    parameters: GetCampaignInputSchema,
    handler: getCampaign,
  },
  create_campaign: {
    description: 'Create a new LinkedIn ad campaign',
    parameters: CreateCampaignInputSchema,
    handler: createCampaign,
  },
  update_campaign: {
    description: 'Update an existing LinkedIn campaign (status, budget, name, etc.)',
    parameters: UpdateCampaignInputSchema,
    handler: updateCampaign,
  },
  delete_campaign: {
    description: 'Archive a LinkedIn campaign (campaigns cannot be hard deleted)',
    parameters: DeleteCampaignInputSchema,
    handler: deleteCampaign,
  },
};
