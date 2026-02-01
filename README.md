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
2. **LinkedIn Developer App** with:
   - **Advertising API** access (for campaign management)
   - **Share on LinkedIn** access (for organic posting)
3. **Access Token** with required scopes:
   - `rw_ads`, `r_ads_reporting` - for campaign management
   - `w_organization_social` - for posting to company pages

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

The easiest way is using the included auth helper (for developers):

```bash
# Clone and setup
git clone https://github.com/Ultrathink-Solutions/linkedin-campaign-manager-mcp.git
cd linkedin-campaign-manager-mcp
npm install

# Create .envrc with your credentials
cat > .envrc << 'EOF'
export LINKEDIN_CLIENT_ID="your-client-id"
export LINKEDIN_CLIENT_SECRET="your-client-secret"
EOF

# Allow direnv and run auth
direnv allow
npm run auth
```

This will:
1. Open your browser to LinkedIn's authorization page
2. After you authorize, capture the callback automatically
3. Exchange the code for an access token
4. Save the token to your `.envrc`

**Alternative**: Use LinkedIn's [OAuth tools in the Developer Portal](https://learn.microsoft.com/en-us/linkedin/shared/authentication/developer-portal-tools) or implement the [3-legged OAuth flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow) manually.

Required scopes:
- `r_ads` - Read ad accounts, campaigns, creatives
- `rw_ads` - Write access for creating/updating
- `r_ads_reporting` - Analytics and reporting

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

**Campaign Management:**
- "List my LinkedIn ad accounts"
- "Show me all active campaigns in account 123456"
- "Create a new website visits campaign with $50/day budget"
- "Get performance analytics for campaign X for the last 7 days"
- "Pause all campaigns in the Summer Sale campaign group"

**Organic Posting (requires Share on LinkedIn access):**
- "Post to our company page: 'Excited to announce our new AI assessment tool!'"
- "List recent posts from our company page"
- "Create a dark post for our ad campaign" (won't show on page feed)
- "Delete the post from yesterday"

## Configuration

| Environment Variable        | Required | Default  | Description                                              |
| --------------------------- | -------- | -------- | -------------------------------------------------------- |
| `LINKEDIN_ACCESS_TOKEN`     | Yes      | -        | OAuth token from Ads app (rw_ads, w_organization_social) |
| `LINKEDIN_COMMUNITY_TOKEN`  | No       | -        | OAuth token from Analytics app (rw_organization_admin)   |
| `LINKEDIN_API_VERSION`      | No       | `202601` | API version in YYYYMM format                             |
| `DEBUG`                     | No       | `false`  | Enable debug logging                                     |

### Why Two Tokens?

LinkedIn requires **Community Management API** to be the only product on an app. Since you also need Advertising API and Share on LinkedIn, you need two separate apps:

| App                       | Products                            | Token Variable            |
| ------------------------- | ----------------------------------- | ------------------------- |
| Ultrathink Ads MCP Server | Advertising API, Share on LinkedIn  | `LINKEDIN_ACCESS_TOKEN`   |
| Ultrathink Analytics      | Community Management API            | `LINKEDIN_COMMUNITY_TOKEN` |

If `LINKEDIN_COMMUNITY_TOKEN` is not set, the organization analytics tools will return an error explaining the setup required.

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

### Organic Posts (Share on LinkedIn)

- `create_post` - Create a post on your company page (text or link)
- `list_posts` - List recent posts from a company page
- `get_post` - Get details of a specific post
- `update_post` - Update post text content
- `delete_post` - Delete a post

### Organization Analytics (Community Management API)

*Requires separate `LINKEDIN_COMMUNITY_TOKEN`*
- `get_share_statistics` - Get post engagement metrics (impressions, clicks, likes, comments, shares)
- `get_follower_statistics` - Get follower counts and demographics
- `get_organization` - Get company page details

## Token Expiration

LinkedIn access tokens expire after 60 days. When your token expires:
1. Generate a new token from the Developer Portal
2. Update your `claude_desktop_config.json`
3. Restart Claude Desktop

## Development

```bash
# Clone the repo
git clone https://github.com/Ultrathink-Solutions/linkedin-campaign-manager-mcp.git
cd linkedin-campaign-manager-mcp

# Install dependencies
npm install

# Setup credentials (create .envrc with LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET)
direnv allow

# Generate access token (opens browser for OAuth)
npm run auth

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
├── index.ts          # MCP server entry point (dual-client support)
├── config.ts         # Configuration loading (supports two tokens)
├── client.ts         # LinkedIn API client wrapper
├── types.ts          # TypeScript types & Zod schemas
├── errors.ts         # Custom error classes
├── tools/            # MCP tool implementations
│   ├── accounts.ts
│   ├── campaigns.ts
│   ├── campaign-groups.ts
│   ├── creatives.ts
│   ├── analytics.ts          # Ad campaign analytics
│   ├── targeting.ts
│   ├── posts.ts               # Organic posting (Share on LinkedIn)
│   └── organization-analytics.ts  # Post stats, followers (Community Mgmt API)
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
