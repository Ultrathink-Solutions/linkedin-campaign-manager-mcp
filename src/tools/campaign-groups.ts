import type { LinkedInClient } from '../client.js';
import {
  ListCampaignGroupsInputSchema,
  CreateCampaignGroupInputSchema,
  UpdateCampaignGroupInputSchema,
} from '../types.js';
import { formatCampaignGroup, buildUrn, buildMoneyAmount, dateToEpochMs } from '../utils/formatters.js';

/**
 * List campaign groups for an ad account.
 */
export async function listCampaignGroups(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { accountId } = ListCampaignGroupsInputSchema.parse(input);

  const response = await client.finder<{ elements: Record<string, unknown>[] }>(
    `/adAccounts/${accountId}/adCampaignGroups`,
    'search',
    {}
  );

  const groups = response.elements.map(formatCampaignGroup);

  return JSON.stringify(
    {
      campaignGroups: groups,
      count: groups.length,
    },
    null,
    2
  );
}

/**
 * Create a new campaign group.
 */
export async function createCampaignGroup(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const params = CreateCampaignGroupInputSchema.parse(input);

  const entity: Record<string, unknown> = {
    account: buildUrn('sponsoredAccount', params.accountId),
    name: params.name,
    status: params.status,
  };

  if (params.totalBudget !== undefined) {
    entity.totalBudget = buildMoneyAmount(params.totalBudget);
  }

  if (params.startDate || params.endDate) {
    entity.runSchedule = {
      ...(params.startDate && { start: dateToEpochMs(params.startDate) }),
      ...(params.endDate && { end: dateToEpochMs(params.endDate) }),
    };
  }

  const response = await client.create<Record<string, unknown>>(
    `/adAccounts/${params.accountId}/adCampaignGroups`,
    entity
  );

  return JSON.stringify(
    {
      message: 'Campaign group created successfully',
      campaignGroup: formatCampaignGroup(response),
    },
    null,
    2
  );
}

/**
 * Update an existing campaign group.
 */
export async function updateCampaignGroup(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { accountId, groupId, ...updates } = UpdateCampaignGroupInputSchema.parse(input);

  const patchSet: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    patchSet.name = updates.name;
  }

  if (updates.status !== undefined) {
    patchSet.status = updates.status;
  }

  if (updates.totalBudget !== undefined) {
    patchSet.totalBudget = buildMoneyAmount(updates.totalBudget);
  }

  if (updates.endDate !== undefined) {
    patchSet['runSchedule.end'] = dateToEpochMs(updates.endDate);
  }

  await client.partialUpdate(
    `/adAccounts/${accountId}/adCampaignGroups`,
    groupId,
    patchSet
  );

  // Fetch and return the updated group
  const updated = await client.get<Record<string, unknown>>(
    `/adAccounts/${accountId}/adCampaignGroups`,
    groupId
  );

  return JSON.stringify(
    {
      message: 'Campaign group updated successfully',
      campaignGroup: formatCampaignGroup(updated),
    },
    null,
    2
  );
}

/**
 * Tool definitions for registration with FastMCP
 */
export const campaignGroupTools = {
  list_campaign_groups: {
    description: 'List campaign groups for a LinkedIn ad account',
    parameters: ListCampaignGroupsInputSchema,
    handler: listCampaignGroups,
  },
  create_campaign_group: {
    description: 'Create a new LinkedIn campaign group for organizing campaigns',
    parameters: CreateCampaignGroupInputSchema,
    handler: createCampaignGroup,
  },
  update_campaign_group: {
    description: 'Update an existing LinkedIn campaign group',
    parameters: UpdateCampaignGroupInputSchema,
    handler: updateCampaignGroup,
  },
};
