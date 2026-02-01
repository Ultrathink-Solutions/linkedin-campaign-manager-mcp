#!/usr/bin/env node

import { FastMCP } from 'fastmcp';
import { loadConfig } from './config.js';
import { createLinkedInClient, LinkedInClient } from './client.js';
import { accountTools } from './tools/accounts.js';
import { campaignTools } from './tools/campaigns.js';
import { campaignGroupTools } from './tools/campaign-groups.js';
import { creativeTools } from './tools/creatives.js';
import { analyticsTools } from './tools/analytics.js';
import { targetingTools } from './tools/targeting.js';
import { postTools } from './tools/posts.js';
import { organizationAnalyticsTools } from './tools/organization-analytics.js';

/**
 * LinkedIn Campaign Manager MCP Server
 *
 * Provides full CRUD access to LinkedIn Campaign Manager and Community Management
 * via the Model Context Protocol.
 *
 * Requires two LinkedIn apps due to API product restrictions:
 * - Ads App: access token with rw_ads, r_ads_reporting, w_organization_social scopes
 * - Analytics App: access token with rw_organization_admin scope (Community Management API)
 */

// Load configuration from environment
const config = loadConfig();

// Create LinkedIn API clients
// Primary client for Ads + Share on LinkedIn
const linkedInClient = createLinkedInClient(config);

// Community Management client (optional, for organization analytics)
// Uses separate token due to LinkedIn's "one product per app" restriction
const communityClient = config.communityToken !== undefined && config.communityToken !== ''
  ? createLinkedInClient({ ...config, accessToken: config.communityToken })
  : null;

// Initialize FastMCP server
const server = new FastMCP({
  name: 'linkedin-campaign-manager',
  version: '0.1.0',
});

/**
 * Helper to create a tool handler that injects the LinkedIn client
 */
function createHandler(
  handler: (input: unknown, client: LinkedInClient) => Promise<string>,
  client: LinkedInClient
): (input: unknown) => Promise<string> {
  return (input: unknown) => handler(input, client);
}

// Register Ads + Posting tools (use primary client)
const adsTools = {
  ...accountTools,
  ...campaignTools,
  ...campaignGroupTools,
  ...creativeTools,
  ...analyticsTools,
  ...targetingTools,
  ...postTools,
};

for (const [name, tool] of Object.entries(adsTools)) {
  server.addTool({
    name,
    description: tool.description,
    parameters: tool.parameters,
    execute: createHandler(tool.handler, linkedInClient),
  });
}

// Register Organization Analytics tools (use community client if available)
if (communityClient !== null) {
  for (const [name, tool] of Object.entries(organizationAnalyticsTools)) {
    server.addTool({
      name,
      description: tool.description,
      parameters: tool.parameters,
      execute: createHandler(tool.handler, communityClient),
    });
  }
} else {
  // Register placeholder tools that explain the missing token
  for (const [name, tool] of Object.entries(organizationAnalyticsTools)) {
    server.addTool({
      name,
      description: `${tool.description} (⚠️ Requires LINKEDIN_COMMUNITY_TOKEN to be set)`,
      parameters: tool.parameters,
      execute: () =>
        Promise.resolve(JSON.stringify({
          error: 'LINKEDIN_COMMUNITY_TOKEN not configured',
          message:
            'Organization analytics require a separate LinkedIn app with Community Management API access. ' +
            'Set the LINKEDIN_COMMUNITY_TOKEN environment variable with a token from that app.',
        })),
    });
  }
}

// Start the server
void server.start({ transportType: 'stdio' });
