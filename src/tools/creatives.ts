import type { LinkedInClient } from '../client.js';
import {
  ListCreativesInputSchema,
  GetCreativeInputSchema,
  CreateCreativeInputSchema,
  UpdateCreativeInputSchema,
  DeleteCreativeInputSchema,
} from '../types.js';
import { formatCreative, buildUrn } from '../utils/formatters.js';

/**
 * List creatives for an ad account, optionally filtered by campaign.
 */
export async function listCreatives(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { accountId, campaignId } = ListCreativesInputSchema.parse(input);

  const queryParams: Record<string, unknown> = {};

  if (campaignId !== undefined && campaignId.trim() !== '') {
    queryParams['search.campaign.values[0]'] = buildUrn('sponsoredCampaign', campaignId);
  }

  const response = await client.finder<{ elements: Record<string, unknown>[] }>(
    `/adAccounts/${accountId}/creatives`,
    'search',
    queryParams
  );

  const creatives = response.elements.map(formatCreative);

  return JSON.stringify(
    {
      creatives,
      count: creatives.length,
    },
    null,
    2
  );
}

/**
 * Get detailed information about a specific creative.
 */
export async function getCreative(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { accountId, creativeId } = GetCreativeInputSchema.parse(input);

  const response = await client.get<Record<string, unknown>>(
    `/adAccounts/${accountId}/creatives`,
    creativeId
  );

  return JSON.stringify(formatCreative(response), null, 2);
}

/**
 * Create a new ad creative.
 */
export async function createCreative(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const params = CreateCreativeInputSchema.parse(input);

  // Build the creative entity based on type
  const entity: Record<string, unknown> = {
    campaign: buildUrn('sponsoredCampaign', params.campaignId),
    status: params.status,
    type: params.type,
  };

  // Build type-specific creative variables
  if (params.type === 'TEXT_AD') {
    if (params.title === undefined || params.title.trim() === '') {
      throw new Error('Title is required for TEXT_AD creatives');
    }
    entity.variables = {
      clickUri: params.destinationUrl,
      data: {
        'com.linkedin.ads.TextAdCreativeVariables': {
          title: params.title,
          text: params.text,
        },
      },
    };
  } else {
    // Sponsored content and other types
    entity.variables = {
      clickUri: params.destinationUrl,
      data: {
        'com.linkedin.ads.SponsoredUpdateCreativeVariables': {
          activity: params.text,
          ...(params.imageUrl !== undefined ? { media: params.imageUrl } : {}),
        },
      },
    };
  }

  const response = await client.create<Record<string, unknown>>(
    `/adAccounts/${params.accountId}/creatives`,
    entity
  );

  return JSON.stringify(
    {
      message: 'Creative created successfully',
      creative: formatCreative(response),
    },
    null,
    2
  );
}

/**
 * Update an existing creative.
 */
export async function updateCreative(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { accountId, creativeId, ...updates } = UpdateCreativeInputSchema.parse(input);

  const patchSet: Record<string, unknown> = {};

  if (updates.status !== undefined) {
    patchSet.status = updates.status;
  }

  // Note: LinkedIn has limited support for updating creative content
  // Most changes require creating a new creative
  if (updates.destinationUrl !== undefined) {
    patchSet['variables.clickUri'] = updates.destinationUrl;
  }

  await client.partialUpdate(
    `/adAccounts/${accountId}/creatives`,
    creativeId,
    patchSet
  );

  // Fetch and return the updated creative
  const updated = await client.get<Record<string, unknown>>(
    `/adAccounts/${accountId}/creatives`,
    creativeId
  );

  return JSON.stringify(
    {
      message: 'Creative updated successfully',
      creative: formatCreative(updated),
    },
    null,
    2
  );
}

/**
 * Delete a creative.
 */
export async function deleteCreative(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { accountId, creativeId } = DeleteCreativeInputSchema.parse(input);

  await client.delete(`/adAccounts/${accountId}/creatives`, creativeId);

  return JSON.stringify(
    {
      message: 'Creative deleted successfully',
      creativeId,
    },
    null,
    2
  );
}

/**
 * Tool definitions for registration with FastMCP
 */
export const creativeTools = {
  list_creatives: {
    description: 'List ad creatives for a LinkedIn ad account, optionally filtered by campaign',
    parameters: ListCreativesInputSchema,
    handler: listCreatives,
  },
  get_creative: {
    description: 'Get detailed information about a specific LinkedIn ad creative',
    parameters: GetCreativeInputSchema,
    handler: getCreative,
  },
  create_creative: {
    description: 'Create a new LinkedIn ad creative (text ad, sponsored content, etc.)',
    parameters: CreateCreativeInputSchema,
    handler: createCreative,
  },
  update_creative: {
    description: 'Update an existing LinkedIn ad creative (limited to status and destination URL)',
    parameters: UpdateCreativeInputSchema,
    handler: updateCreative,
  },
  delete_creative: {
    description: 'Delete a LinkedIn ad creative',
    parameters: DeleteCreativeInputSchema,
    handler: deleteCreative,
  },
};
