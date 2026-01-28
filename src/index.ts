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

/**
 * LinkedIn Campaign Manager MCP Server
 *
 * Provides full CRUD access to LinkedIn Campaign Manager via the Model Context Protocol.
 * Requires a LinkedIn access token with rw_ads scope.
 */

// Load configuration from environment
const config = loadConfig();

// Create LinkedIn API client
const linkedInClient = createLinkedInClient(config);

// Initialize FastMCP server
const server = new FastMCP({
  name: 'linkedin-campaign-manager',
  version: '0.1.0',
});

/**
 * Helper to create a tool handler that injects the LinkedIn client
 */
function createHandler(
  handler: (input: unknown, client: LinkedInClient) => Promise<string>
): (input: unknown) => Promise<string> {
  return (input: unknown) => handler(input, linkedInClient);
}

// Register all tools
const allTools = {
  ...accountTools,
  ...campaignTools,
  ...campaignGroupTools,
  ...creativeTools,
  ...analyticsTools,
  ...targetingTools,
};

for (const [name, tool] of Object.entries(allTools)) {
  server.addTool({
    name,
    description: tool.description,
    parameters: tool.parameters,
    execute: createHandler(tool.handler),
  });
}

// Start the server
server.start({ transportType: 'stdio' });
