# LinkedIn Campaign Manager MCP Server

An open-source [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that provides full CRUD access to LinkedIn Campaign Manager. Use it with Claude Desktop or any MCP-compatible client to manage your LinkedIn ads through natural language.

## Features

- **Full CRUD Operations**: Create, read, update, and delete campaigns, creatives, and campaign groups
- **Analytics & Reporting**: Get performance metrics with flexible pivoting (by campaign, creative, demographics, etc.)
- **Targeting Tools**: Search targeting entities, estimate audience sizes
- **Type-Safe**: Built with TypeScript and Zod validation
- **Official SDK**: Uses LinkedIn's official `linkedin-api-client` library

## Prerequisites

1. **Node.js 18+**
2. **LinkedIn Developer App** with Advertising API access
3. **Access Token** with `rw_ads` and `r_ads_reporting` scopes

## Installation

```bash
# Via npx (recommended)
npx linkedin-campaign-manager-mcp

# Or install globally
npm install -g linkedin-campaign-manager-mcp
```

## Quick Start

### 1. Create a LinkedIn Developer App

1. Go to [LinkedIn Developer Portal](https://developer.linkedin.com/)
2. Click **Create App**
3. Associate with your Company Page
4. Under **Products**, request access to **Advertising API**
5. Wait for approval (typically 1-3 business days)

### 2. Generate an Access Token

Generate a token with the following scopes:
- `r_ads` - Read ad accounts, campaigns, creatives
- `rw_ads` - Write access for creating/updating
- `r_ads_reporting` - Analytics and reporting

You can use LinkedIn's OAuth tools in the Developer Portal or implement the [3-legged OAuth flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow).

### 3. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "linkedin-campaign-manager": {
      "command": "npx",
      "args": ["-y", "linkedin-campaign-manager-mcp"],
      "env": {
        "LINKEDIN_ACCESS_TOKEN": "your-access-token-here"
      }
    }
  }
}
```

### 4. Start Using It

Ask Claude things like:
- "List my LinkedIn ad accounts"
- "Show me all active campaigns in account 123456"
- "Create a new website visits campaign with $50/day budget"
- "Get performance analytics for campaign X for the last 7 days"
- "Pause all campaigns in the Summer Sale campaign group"

## Configuration

| Environment Variable | Required | Default | Description |
|---------------------|----------|---------|-------------|
| `LINKEDIN_ACCESS_TOKEN` | Yes | - | OAuth access token with rw_ads scope |
| `LINKEDIN_API_VERSION` | No | `202601` | API version in YYYYMM format |
| `DEBUG` | No | `false` | Enable debug logging |

## Available Tools

### Account Management
- `list_ad_accounts` - List all accessible ad accounts
- `get_ad_account` - Get details of a specific account

### Campaign Management
- `list_campaigns` - List campaigns with optional filters
- `get_campaign` - Get campaign details
- `create_campaign` - Create a new campaign
- `update_campaign` - Update campaign settings
- `delete_campaign` - Archive a campaign

### Campaign Groups
- `list_campaign_groups` - List campaign groups
- `create_campaign_group` - Create a new group
- `update_campaign_group` - Update group settings

### Creative Management
- `list_creatives` - List ad creatives
- `get_creative` - Get creative details
- `create_creative` - Create a new creative
- `update_creative` - Update creative settings
- `delete_creative` - Delete a creative

### Analytics
- `get_analytics` - Get performance metrics with flexible pivoting
- `get_campaign_performance` - Get campaign-level performance summary

### Targeting
- `list_targeting_facets` - List available targeting dimensions
- `search_targeting_entities` - Search for targeting values
- `estimate_audience` - Estimate audience size for criteria

## Token Expiration

LinkedIn access tokens expire after 60 days. When your token expires:
1. Generate a new token from the Developer Portal
2. Update your `claude_desktop_config.json`
3. Restart Claude Desktop

## Development

```bash
# Clone the repo
git clone https://github.com/your-org/linkedin-campaign-manager-mcp.git
cd linkedin-campaign-manager-mcp

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run linting
npm run lint

# Type check
npm run typecheck
```

## Project Structure

```
src/
├── index.ts          # MCP server entry point
├── config.ts         # Configuration loading
├── client.ts         # LinkedIn API client wrapper
├── types.ts          # TypeScript types & Zod schemas
├── errors.ts         # Custom error classes
├── tools/            # MCP tool implementations
│   ├── accounts.ts
│   ├── campaigns.ts
│   ├── creatives.ts
│   ├── analytics.ts
│   └── targeting.ts
└── utils/
    └── formatters.ts # Response formatting
```

## API Version

This server uses LinkedIn Marketing API version `202601` by default. LinkedIn sunsets API versions approximately one year after release. To use a different version:

```json
{
  "env": {
    "LINKEDIN_ACCESS_TOKEN": "...",
    "LINKEDIN_API_VERSION": "202607"
  }
}
```

## Limitations

- **Single User**: Each instance uses one access token. For multi-user scenarios, each user needs their own instance.
- **Development Tier**: LinkedIn's Development tier limits access to your own ad accounts. Standard tier requires partner approval.
- **Token Refresh**: Manual token refresh required every 60 days.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Resources

- [LinkedIn Marketing API Documentation](https://learn.microsoft.com/en-us/linkedin/marketing/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [linkedin-api-client](https://github.com/linkedin-developers/linkedin-api-js-client)
