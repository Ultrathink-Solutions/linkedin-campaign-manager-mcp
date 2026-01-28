import type { LinkedInClient } from '../client.js';
import { ListAdAccountsInputSchema, GetAdAccountInputSchema } from '../types.js';
import { formatAdAccount } from '../utils/formatters.js';

/**
 * List all ad accounts accessible to the authenticated user.
 */
export async function listAdAccounts(
  _input: unknown,
  client: LinkedInClient
): Promise<string> {
  // Validate input (empty object expected)
  ListAdAccountsInputSchema.parse(_input);

  const response = await client.finder<{ elements: Record<string, unknown>[] }>(
    '/adAccounts',
    'search',
    {}
  );

  const accounts = response.elements.map(formatAdAccount);

  return JSON.stringify(
    {
      accounts,
      count: accounts.length,
    },
    null,
    2
  );
}

/**
 * Get detailed information about a specific ad account.
 */
export async function getAdAccount(
  input: unknown,
  client: LinkedInClient
): Promise<string> {
  const { accountId } = GetAdAccountInputSchema.parse(input);

  const response = await client.get<Record<string, unknown>>('/adAccounts', accountId);

  return JSON.stringify(formatAdAccount(response), null, 2);
}

/**
 * Tool definitions for registration with FastMCP
 */
export const accountTools = {
  list_ad_accounts: {
    description: 'List all LinkedIn ad accounts accessible to the authenticated user',
    parameters: ListAdAccountsInputSchema,
    handler: listAdAccounts,
  },
  get_ad_account: {
    description: 'Get detailed information about a specific LinkedIn ad account',
    parameters: GetAdAccountInputSchema,
    handler: getAdAccount,
  },
};
