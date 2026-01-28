# LinkedIn Campaign Manager MCP Server - Implementation Plan

**Created:** 2026-01-28
**Status:** In Progress - Phase 1 (Foundation)
**Project:** linkedin-campaign-manager-mcp
**Last Updated:** 2026-01-28

---

## Progress Log

### 2026-01-28 - Project Scaffolding Complete

**Completed:**
- [x] Research LinkedIn Marketing API capabilities, access tiers, rate limits
- [x] Research MCP server best practices (FastMCP, OAuth patterns)
- [x] Define simplified architecture (self-hosted, stdio, token-in-env)
- [x] Create project structure with TypeScript strict mode
- [x] Configure development environment (ESLint, Prettier, Vitest)
- [x] Define all Zod schemas for tool inputs (`src/types.ts`)
- [x] Implement error handling layer (`src/errors.ts`)
- [x] Implement configuration loader (`src/config.ts`)
- [x] Implement LinkedIn client wrapper with retry logic (`src/client.ts`)
- [x] Implement response formatters (`src/utils/formatters.ts`)
- [x] Scaffold all tool handlers (accounts, campaigns, creatives, analytics, targeting)
- [x] Write unit tests for config, errors, formatters
- [x] Create README and LICENSE

**Next:**
- [ ] Install dependencies and verify build
- [ ] Run tests and fix any issues
- [ ] Test against real LinkedIn API (requires access token)
- [ ] Refine tool implementations based on actual API responses

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Research Findings](#research-findings)
3. [Requirements](#requirements)
4. [Architecture](#architecture)
5. [Development Environment](#development-environment)
6. [Tool Definitions](#tool-definitions)
7. [Implementation Plan](#implementation-plan)
8. [User Setup Guide](#user-setup-guide)
9. [Open Questions & Risks](#open-questions--risks)
10. [References](#references)

---

## Executive Summary

### Problem Statement

No open-source LinkedIn Campaign Manager MCP server with full read/write capabilities exists. The available options are:

| Server | Open Source | Campaign Manager | Read | Write |
|--------|-------------|------------------|------|-------|
| CData LinkedIn Ads MCP | Yes | Yes | Yes | No (paid only) |
| fredericbarthelet/linkedin-mcp-server | Yes | No (Community API) | Yes | Limited |
| Dishant27/linkedin-mcp-server | Yes | No | Yes | Limited |
| adhikasp/mcp-linkedin | Yes | No (Feeds/Jobs) | Yes | Limited |

### Solution

Build an open-source, npm-distributed MCP server that:
- Provides full CRUD access to LinkedIn Campaign Manager
- Runs locally via stdio transport
- Uses user-provided credentials (no hosted infrastructure)
- Leverages the official `linkedin-api-client` SDK

### Why This Gap Exists

1. **LinkedIn's restricted API access** - Marketing API requires partner approval for multi-user solutions
2. **MCP third-party OAuth complexity** - Hosting an MCP server with OAuth is architecturally complex
3. **API versioning overhead** - LinkedIn sunsets versions yearly, requiring maintenance

Our approach sidesteps these issues by having each user provide their own credentials.

---

## Research Findings

### LinkedIn Marketing API

#### Access Tiers

| Tier | Ad Accounts | Requirements | Approval Time |
|------|-------------|--------------|---------------|
| **Development** | Your own account(s) | Self-service via Developer Portal | Instant |
| **Standard** | Unlimited third-party | Partner application | Weeks to months |

**Key Finding:** Development tier is sufficient for our single-user, self-hosted model. Each user accesses their own ad accounts with their own credentials.

#### Required OAuth Scopes

| Scope | Purpose | Required |
|-------|---------|----------|
| `r_ads` | Read ad accounts, campaigns, creatives | Yes |
| `rw_ads` | Full CRUD access | Yes |
| `r_ads_reporting` | Analytics/reporting data | Yes |
| `r_organization_social` | Organization page data (some ad types) | Optional |

#### API Versioning

LinkedIn uses date-based versioning in `YYYYMM` format. Current version: `202601` (January 2026).

**Required Headers:**
```
Authorization: Bearer {access_token}
Linkedin-Version: 202601
X-Restli-Protocol-Version: 2.0.0
Content-Type: application/json
```

**Important:** Versions are sunset after ~1 year. The server should make version configurable.

#### Rate Limits

- Application-level throttling (daily limits)
- User-level throttling (per-token limits)
- Endpoint-specific limits
- Returns `429 Too Many Requests` with `X-RateLimit-*` headers

**Best Practices:**
- Implement exponential backoff
- Monitor rate limit headers
- Use batch operations where available

#### Core API Endpoints

| Resource | Base Endpoint | Operations |
|----------|---------------|------------|
| Ad Accounts | `/rest/adAccounts` | Create, Read, Update |
| Campaign Groups | `/rest/adAccounts/{id}/adCampaignGroups` | CRUD |
| Campaigns | `/rest/adAccounts/{id}/adCampaigns` | CRUD |
| Creatives | `/rest/adAccounts/{id}/creatives` | CRUD |
| Targeting Facets | `/rest/adTargetingFacets` | Read |
| Targeting Entities | `/rest/adTargetingEntities` | Read |
| Audience Counts | `/rest/audienceCounts` | Read |
| Budget Pricing | `/rest/adBudgetPricing` | Read |
| Ad Analytics | `/rest/adAnalytics` | Read |

#### Analytics Pivot Dimensions

| Pivot | Description |
|-------|-------------|
| `ACCOUNT` | Group by ad account |
| `CAMPAIGN` | Group by campaign (default) |
| `CREATIVE` | Group by creative |
| `COMPANY` | Group by advertiser company |
| `MEMBER_COMPANY` | Group by member's company |
| `MEMBER_COMPANY_SIZE` | Group by member company size |
| `MEMBER_COUNTRY_V2` | Group by member country |
| `MEMBER_REGION_V2` | Group by member region |

**Limitations:**
- Max 20 metrics per API call
- No pagination on adAnalytics endpoint
- Demographic data retained for 2 years only

### MCP Server Best Practices

#### SDK Options

| SDK | Language | Maturity | Notes |
|-----|----------|----------|-------|
| Official MCP TypeScript SDK | TypeScript | Stable (v1.x, v2 Q1 2026) | Recommended |
| FastMCP | TypeScript | Production-ready | Simplifies boilerplate |
| FastMCP (Python) | Python | Production-ready | Alternative if Python preferred |

**Decision:** Use **FastMCP (TypeScript)** because:
- Official LinkedIn SDK (`linkedin-api-client`) is TypeScript
- Better type safety with Zod validation
- Cleaner decorator-based API
- Good OAuth handling patterns

#### Transport

For npm-distributed, locally-run servers: **stdio transport** is standard.

No need for HTTP/SSE transport since we're not hosting remotely.

#### Authentication Patterns

For self-hosted MCP servers, the established pattern is **token-in-environment-variable**:
- GitHub MCP → `GITHUB_TOKEN`
- Slack MCP → `SLACK_BOT_TOKEN`
- Linear MCP → `LINEAR_API_KEY`

We'll follow this pattern: `LINKEDIN_ACCESS_TOKEN`

### Official LinkedIn API Client Libraries

LinkedIn provides official API client libraries that we **must use** to avoid reinventing the wheel:

#### JavaScript/TypeScript: `linkedin-api-client`

**npm:** `npm install linkedin-api-client`
**GitHub:** [linkedin-developers/linkedin-api-js-client](https://github.com/linkedin-developers/linkedin-api-js-client)
**Status:** Beta (but official and recommended by LinkedIn)

**What it provides:**
- `RestliClient` - Handles all Rest.li protocol complexity
- `AuthClient` - Token generation, inspection, and refresh
- Automatic URL encoding (Rest.li 2.0 requires encoding `(`, `)`, `:`, `,`)
- Automatic query tunneling for long URLs
- TypeScript interfaces for IDE completion
- Support for all Rest.li methods: GET, BATCH_GET, FINDER, CREATE, UPDATE, PARTIAL_UPDATE, DELETE, ACTION

**What it does NOT provide:**
- API-specific abstractions (we build these)
- MCP tool definitions (we build these)
- Caching or rate limit handling (we build these)
- Response formatting for Claude (we build these)

**Example usage (from official docs):**
```typescript
import { RestliClient } from 'linkedin-api-client';

const restliClient = new RestliClient();

// Find ad accounts
const response = await restliClient.finder({
  resourcePath: '/adAccounts',
  finderName: 'search',
  queryParams: {
    search: {
      status: {
        values: ['ACTIVE']
      }
    }
  },
  accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
  versionString: '202601'
});
```

#### Python Alternative: `linkedin-api-python-client`

**pip:** `pip install linkedin-api-client`
**GitHub:** [linkedin-developers/linkedin-api-python-client](https://github.com/linkedin-developers/linkedin-api-python-client)

If we chose Python/FastMCP-Python, this would be the equivalent.

### Other Resources to Leverage

| Resource | Use For |
|----------|---------|
| [FastMCP](https://github.com/punkpeye/fastmcp) | MCP server framework (simplifies tool definitions) |
| [fredericbarthelet/linkedin-mcp-server](https://github.com/fredericbarthelet/linkedin-mcp-server) | Reference for MCP + LinkedIn OAuth patterns |
| [tap-linkedin-ads](https://github.com/singer-io/tap-linkedin-ads) | Reference for endpoint coverage and data models |
| [LinkedIn Postman Collection](https://www.postman.com/linkedin-developer-apis/linkedin-marketing-solutions-versioned-apis/overview) | API testing, schema reference, request examples |

### What We Build vs What We Reuse

| Component | Build or Reuse |
|-----------|----------------|
| Rest.li protocol handling | **Reuse** (`linkedin-api-client`) |
| OAuth token handling | **Reuse** (`linkedin-api-client` AuthClient) |
| URL encoding | **Reuse** (`linkedin-api-client`) |
| Query tunneling | **Reuse** (`linkedin-api-client`) |
| MCP server framework | **Reuse** (FastMCP) |
| MCP tool definitions | **Build** |
| Input validation (Zod schemas) | **Build** |
| Response formatting | **Build** |
| Error handling/retry logic | **Build** |
| Rate limit handling | **Build** |
| API endpoint wrappers | **Build** (thin layer over RestliClient) |

---

## Requirements

### Functional Requirements

#### Must Have (MVP)

1. **Ad Account Management**
   - List ad accounts accessible to authenticated user
   - Get ad account details

2. **Campaign Management**
   - List campaigns (with filtering by status)
   - Get campaign details
   - Create campaign
   - Update campaign (status, budget, targeting, schedule)
   - Archive/delete campaign

3. **Campaign Group Management**
   - List campaign groups
   - Get campaign group details
   - Create campaign group
   - Update campaign group

4. **Creative Management**
   - List creatives for a campaign
   - Get creative details
   - Create creative (text ads, sponsored content)
   - Update creative
   - Delete creative

5. **Analytics**
   - Get campaign performance metrics
   - Support for common pivots (campaign, creative, account)
   - Date range filtering

#### Should Have (Phase 2)

6. **Targeting**
   - List available targeting facets
   - Search targeting entities (locations, industries, job titles, etc.)
   - Estimate audience size
   - Get budget/bid recommendations

7. **Advanced Analytics**
   - Demographic breakdowns
   - All pivot dimensions
   - Custom metric selection

#### Could Have (Future)

8. **Batch Operations**
   - Bulk campaign creation
   - Bulk status updates

9. **Local OAuth Flow**
   - Browser-based authentication for token generation
   - Automatic token refresh

### Non-Functional Requirements

1. **Distribution**
   - Published to npm
   - Runnable via `npx linkedin-campaign-manager-mcp`

2. **Transport**
   - stdio only (no HTTP server required)

3. **Authentication**
   - Token provided via environment variable
   - No hosted infrastructure
   - No token storage beyond local environment

4. **Error Handling**
   - Clear, actionable error messages
   - Rate limit handling with backoff
   - Graceful degradation on API errors

5. **Maintainability**
   - API version configurable via environment
   - TypeScript for type safety
   - Comprehensive JSDoc comments

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Machine                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐         ┌──────────────────────────────┐ │
│   │   Claude    │◄─stdio─►│  linkedin-campaign-mcp       │ │
│   │   Desktop   │         │                              │ │
│   └─────────────┘         │  ┌────────────────────────┐  │ │
│                           │  │     FastMCP Server     │  │ │
│                           │  │                        │  │ │
│   Environment:            │  │  ┌──────────────────┐  │  │ │
│   LINKEDIN_ACCESS_TOKEN   │  │  │   Tool Handlers  │  │  │ │
│   LINKEDIN_API_VERSION    │  │  └────────┬─────────┘  │  │ │
│                           │  │           │            │  │ │
│                           │  │  ┌────────▼─────────┐  │  │ │
│                           │  │  │  LinkedIn Client │  │  │ │
│                           │  │  └────────┬─────────┘  │  │ │
│                           │  └───────────┼────────────┘  │ │
│                           └──────────────┼───────────────┘ │
│                                          │                 │
└──────────────────────────────────────────┼─────────────────┘
                                           │
                                           ▼
                              ┌────────────────────────┐
                              │   LinkedIn Marketing   │
                              │         API            │
                              │  api.linkedin.com/rest │
                              └────────────────────────┘
```

### Project Structure

```
linkedin-campaign-manager-mcp/
├── src/
│   ├── index.ts                 # Entry point, FastMCP server setup
│   ├── config.ts                # Environment variable handling
│   ├── client.ts                # LinkedIn API client wrapper
│   ├── types.ts                 # TypeScript types & Zod schemas
│   ├── errors.ts                # Custom error classes
│   ├── tools/
│   │   ├── index.ts             # Tool registration
│   │   ├── accounts.ts          # Ad account tools
│   │   ├── campaigns.ts         # Campaign CRUD tools
│   │   ├── campaign-groups.ts   # Campaign group tools
│   │   ├── creatives.ts         # Creative CRUD tools
│   │   ├── targeting.ts         # Targeting lookup tools
│   │   └── analytics.ts         # Reporting/analytics tools
│   └── utils/
│       ├── rate-limiter.ts      # Rate limit handling
│       └── formatters.ts        # Response formatting helpers
├── tests/
│   ├── tools/
│   │   └── *.test.ts
│   └── client.test.ts
├── docs/
│   ├── worktracking/
│   │   └── 2026-01-28-implementation-plan.md
│   └── setup-guide.md
├── package.json
├── tsconfig.json
├── .gitignore
├── .eslintrc.js
├── LICENSE
└── README.md
```

### Key Design Decisions

#### 1. FastMCP over Raw MCP SDK

**Rationale:** FastMCP provides:
- Cleaner tool definition API
- Built-in Zod schema support
- Automatic error handling
- Less boilerplate

**Trade-off:** Additional dependency, but actively maintained and widely used.

#### 2. linkedin-api-client as API Layer

**Rationale:** Official LinkedIn SDK that:
- Handles Rest.li protocol complexity
- Manages URL encoding requirements
- Provides TypeScript types
- Maintained by LinkedIn

**Trade-off:** Still in beta, but more reliable than building from scratch.

#### 3. Token-in-Environment Authentication

**Rationale:**
- Established MCP pattern (GitHub, Slack, Linear)
- No server-side storage needed
- User controls their own credentials
- Simple to understand and configure

**Trade-off:** Manual token refresh required (60-day expiry), but acceptable for developer audience.

#### 4. Configurable API Version

**Rationale:** LinkedIn sunsets API versions yearly. Making version configurable via `LINKEDIN_API_VERSION` allows:
- Users to pin to known-working version
- Easy migration when new versions release
- Graceful handling of deprecation

---

## Development Environment

### TypeScript Configuration

**Target:** ES2022 with Node.js 18+ (LTS)

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Key Settings:**
- `strict: true` - Full type safety
- `noImplicitAny` - No implicit any types
- `declaration: true` - Generate .d.ts files for consumers
- `NodeNext` module resolution - Proper ESM support

### Linting & Formatting

**ESLint** with TypeScript support:

```json
// .eslintrc.json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/strict-boolean-expressions": "warn"
  }
}
```

**Prettier** for consistent formatting:

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Package Configuration

```json
// package.json (key fields)
{
  "name": "linkedin-campaign-manager-mcp",
  "version": "0.1.0",
  "description": "MCP server for LinkedIn Campaign Manager with full CRUD support",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "linkedin-campaign-manager-mcp": "dist/index.js"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write src/**/*.ts",
    "format:check": "prettier --check src/**/*.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run lint && npm run typecheck && npm run test && npm run build"
  },
  "keywords": ["mcp", "linkedin", "campaign-manager", "advertising", "claude"],
  "license": "MIT"
}
```

### Dependencies

**Runtime:**
```
linkedin-api-client    - Official LinkedIn REST client
fastmcp                - MCP server framework
zod                    - Runtime schema validation
```

**Development:**
```
typescript             - TypeScript compiler
@types/node            - Node.js type definitions
eslint                 - Linting
@typescript-eslint/*   - TypeScript ESLint plugins
prettier               - Code formatting
vitest                 - Test framework
@vitest/coverage-v8    - Coverage reporting
```

### Testing Strategy

#### Philosophy

**Test OUR code, not third-party libraries.**

- DO NOT test that `linkedin-api-client` makes correct HTTP calls
- DO NOT test that Zod validates schemas correctly
- DO NOT test that FastMCP handles MCP protocol correctly

**DO test:**
- Our business logic (parameter transformation, response formatting)
- Our error handling logic
- Our configuration parsing
- Our tool handler behavior with mocked dependencies

#### Test Structure

```
tests/
├── unit/
│   ├── config.test.ts           # Configuration parsing
│   ├── formatters.test.ts       # Response formatting
│   ├── rate-limiter.test.ts     # Rate limit logic
│   └── errors.test.ts           # Error transformation
├── tools/
│   ├── accounts.test.ts         # Account tool handlers
│   ├── campaigns.test.ts        # Campaign tool handlers
│   ├── creatives.test.ts        # Creative tool handlers
│   └── analytics.test.ts        # Analytics tool handlers
└── integration/
    └── client.test.ts           # Client wrapper with mocked API
```

#### Testing Approach

**Unit Tests (tools/*.test.ts):**
- Mock `linkedin-api-client` calls
- Test that tool handlers correctly transform input parameters
- Test that tool handlers correctly format API responses
- Test error handling paths

Example:
```typescript
// tests/tools/campaigns.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createCampaignHandler } from '../../src/tools/campaigns';

describe('createCampaignHandler', () => {
  it('transforms input parameters to LinkedIn API format', async () => {
    const mockClient = {
      create: vi.fn().mockResolvedValue({
        data: { id: '123' },
        headers: { 'x-restli-id': '123' }
      })
    };

    const input = {
      accountId: '12345',
      name: 'Test Campaign',
      dailyBudget: 100,
      costType: 'CPC' as const,
      objectiveType: 'WEBSITE_VISITS' as const
    };

    await createCampaignHandler(input, mockClient);

    // Verify WE correctly transformed the input
    expect(mockClient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: expect.objectContaining({
          account: 'urn:li:sponsoredAccount:12345',
          name: 'Test Campaign',
          dailyBudget: { amount: '100', currencyCode: 'USD' }
        })
      })
    );
  });

  it('handles missing optional parameters', async () => {
    // Test our default value logic
  });

  it('throws descriptive error for invalid status', async () => {
    // Test our validation logic
  });
});
```

**Integration Tests (client.test.ts):**
- Mock HTTP responses at the axios level
- Test full request/response cycle through our client wrapper
- Verify headers, versioning, error handling

#### Coverage Goals

| Category | Target |
|----------|--------|
| Business logic | >90% |
| Error handlers | >80% |
| Happy paths | 100% |
| Configuration | >90% |

### CI/CD

**GitHub Actions Workflow:**

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:coverage
      - run: npm run build

  publish:
    needs: test
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Tool Definitions

### Account Tools

#### `list_ad_accounts`

List all ad accounts accessible to the authenticated user.

**Parameters:** None

**Returns:** Array of ad accounts with id, name, status, currency

---

#### `get_ad_account`

Get detailed information about a specific ad account.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |

**Returns:** Full ad account object

---

### Campaign Tools

#### `list_campaigns`

List campaigns for an ad account with optional filters.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `status` | enum | No | Filter: ACTIVE, PAUSED, ARCHIVED, CANCELED, DRAFT |
| `campaignGroupId` | string | No | Filter by campaign group |

**Returns:** Array of campaigns

---

#### `get_campaign`

Get detailed information about a specific campaign.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `campaignId` | string | Yes | The campaign ID |

**Returns:** Full campaign object including targeting, budget, schedule

---

#### `create_campaign`

Create a new LinkedIn ad campaign.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `name` | string | Yes | Campaign name |
| `objectiveType` | enum | Yes | BRAND_AWARENESS, WEBSITE_VISITS, ENGAGEMENT, VIDEO_VIEWS, LEAD_GENERATION, WEBSITE_CONVERSIONS, JOB_APPLICANTS |
| `campaignGroupId` | string | No | Parent campaign group |
| `dailyBudget` | number | Yes | Daily budget in account currency |
| `costType` | enum | Yes | CPC, CPM, CPV |
| `startDate` | string | No | ISO date, defaults to now |
| `endDate` | string | No | ISO date, optional |
| `targetingCriteria` | object | No | Targeting configuration |
| `status` | enum | No | ACTIVE, PAUSED, DRAFT (default: DRAFT) |

**Returns:** Created campaign object with ID

---

#### `update_campaign`

Update an existing campaign.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `campaignId` | string | Yes | The campaign ID |
| `name` | string | No | New campaign name |
| `status` | enum | No | ACTIVE, PAUSED, ARCHIVED |
| `dailyBudget` | number | No | New daily budget |
| `endDate` | string | No | New end date |
| `targetingCriteria` | object | No | Updated targeting |

**Returns:** Updated campaign object

---

#### `delete_campaign`

Archive a campaign (LinkedIn doesn't support hard delete).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `campaignId` | string | Yes | The campaign ID |

**Returns:** Confirmation message

---

### Campaign Group Tools

#### `list_campaign_groups`

List campaign groups for an ad account.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |

**Returns:** Array of campaign groups

---

#### `create_campaign_group`

Create a new campaign group.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `name` | string | Yes | Group name |
| `totalBudget` | number | No | Total budget cap |
| `startDate` | string | No | ISO date |
| `endDate` | string | No | ISO date |
| `status` | enum | No | ACTIVE, PAUSED (default: ACTIVE) |

**Returns:** Created campaign group with ID

---

#### `update_campaign_group`

Update an existing campaign group.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `groupId` | string | Yes | The campaign group ID |
| `name` | string | No | New name |
| `status` | enum | No | ACTIVE, PAUSED, ARCHIVED |
| `totalBudget` | number | No | New budget cap |
| `endDate` | string | No | New end date |

**Returns:** Updated campaign group

---

### Creative Tools

#### `list_creatives`

List creatives for a campaign.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `campaignId` | string | No | Filter by campaign |

**Returns:** Array of creatives

---

#### `get_creative`

Get details of a specific creative.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `creativeId` | string | Yes | The creative ID |

**Returns:** Full creative object

---

#### `create_creative`

Create a new ad creative.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `campaignId` | string | Yes | Parent campaign ID |
| `type` | enum | Yes | TEXT_AD, SPONSORED_UPDATE, SPONSORED_VIDEO |
| `title` | string | Conditional | Required for TEXT_AD |
| `text` | string | Yes | Ad copy/description |
| `destinationUrl` | string | Yes | Click-through URL |
| `imageUrl` | string | Conditional | Required for sponsored content |
| `status` | enum | No | ACTIVE, PAUSED (default: ACTIVE) |

**Returns:** Created creative with ID

---

#### `update_creative`

Update an existing creative.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `creativeId` | string | Yes | The creative ID |
| `status` | enum | No | ACTIVE, PAUSED |
| `text` | string | No | Updated copy |
| `destinationUrl` | string | No | Updated URL |

**Returns:** Updated creative

---

#### `delete_creative`

Delete a creative.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `creativeId` | string | Yes | The creative ID |

**Returns:** Confirmation message

---

### Targeting Tools

#### `list_targeting_facets`

Get available targeting dimensions.

**Parameters:** None

**Returns:** Array of facets with names and entity finders

---

#### `search_targeting_entities`

Search for targeting values within a facet.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `facet` | string | Yes | Facet type: locations, industries, seniorities, jobFunctions, titles, skills, companies, schools |
| `query` | string | No | Search term |
| `limit` | number | No | Max results (default: 20) |

**Returns:** Array of targeting entities with URNs and names

---

#### `estimate_audience`

Get estimated audience size for targeting criteria.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `includedLocations` | string[] | Yes | Location URNs to include |
| `includedIndustries` | string[] | No | Industry URNs |
| `includedSeniorities` | string[] | No | Seniority URNs |
| `includedJobFunctions` | string[] | No | Job function URNs |
| `excludedSeniorities` | string[] | No | Seniorities to exclude |

**Returns:** Audience count (total and active)

---

#### `get_budget_pricing`

Get bid and budget recommendations.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `campaignType` | enum | Yes | TEXT_AD, SPONSORED_UPDATES |
| `bidType` | enum | Yes | CPC, CPM |
| `dailyBudget` | number | Yes | Proposed daily budget |
| `targetingCriteria` | object | Yes | Targeting to price |

**Returns:** Suggested bid, min/max bid, budget limits

---

### Analytics Tools

#### `get_analytics`

Get performance analytics with flexible pivoting.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `startDate` | string | Yes | ISO date (YYYY-MM-DD) |
| `endDate` | string | Yes | ISO date (YYYY-MM-DD) |
| `pivot` | enum | No | ACCOUNT, CAMPAIGN, CREATIVE (default: CAMPAIGN) |
| `campaignIds` | string[] | No | Filter to specific campaigns |
| `metrics` | string[] | No | Specific metrics to return |

**Returns:** Analytics data grouped by pivot

**Default Metrics:**
- impressions, clicks, costInLocalCurrency
- ctr (click-through rate)
- averageCpc (average cost per click)

---

#### `get_campaign_performance`

Convenience wrapper for campaign-level analytics.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountId` | string | Yes | The ad account ID |
| `campaignId` | string | Yes | The campaign ID |
| `startDate` | string | Yes | ISO date |
| `endDate` | string | Yes | ISO date |

**Returns:** Campaign performance summary

---

## Implementation Plan

### Phase 1: Foundation & MVP Read Operations (Week 1)

**Goal:** Working MCP server with read operations.

#### Tasks

- [ ] Project setup
  - [ ] Initialize npm package with TypeScript
  - [ ] Configure ESLint, Prettier
  - [ ] Add FastMCP and linkedin-api-client dependencies
  - [ ] Create basic project structure

- [ ] Configuration layer
  - [ ] Environment variable handling (config.ts)
  - [ ] Token validation on startup
  - [ ] API version configuration

- [ ] LinkedIn client wrapper
  - [ ] Initialize RestliClient with token
  - [ ] Add version header handling
  - [ ] Basic error transformation
  - [ ] Rate limit detection

- [ ] Account tools
  - [ ] `list_ad_accounts`
  - [ ] `get_ad_account`

- [ ] Campaign read tools
  - [ ] `list_campaigns`
  - [ ] `get_campaign`
  - [ ] `list_campaign_groups`

- [ ] Creative read tools
  - [ ] `list_creatives`
  - [ ] `get_creative`

- [ ] Basic analytics
  - [ ] `get_analytics` (campaign pivot only)

- [ ] Documentation
  - [ ] README with basic setup instructions
  - [ ] Example Claude Desktop config

---

### Phase 2: Write Operations (Week 2)

**Goal:** Full CRUD for campaigns and creatives.

#### Tasks

- [ ] Campaign write tools
  - [ ] `create_campaign`
  - [ ] `update_campaign`
  - [ ] `delete_campaign` (archive)
  - [ ] `create_campaign_group`
  - [ ] `update_campaign_group`

- [ ] Creative write tools
  - [ ] `create_creative`
  - [ ] `update_creative`
  - [ ] `delete_creative`

- [ ] Input validation
  - [ ] Zod schemas for all create/update operations
  - [ ] LinkedIn-specific validation (budget minimums, etc.)
  - [ ] Helpful error messages for invalid input

- [ ] Error handling improvements
  - [ ] Rate limit retry with exponential backoff
  - [ ] Graceful handling of LinkedIn API errors
  - [ ] Permission/scope error detection

---

### Phase 3: Targeting & Advanced Analytics (Week 3)

**Goal:** Complete targeting and analytics capabilities.

#### Tasks

- [ ] Targeting tools
  - [ ] `list_targeting_facets`
  - [ ] `search_targeting_entities`
  - [ ] `estimate_audience`
  - [ ] `get_budget_pricing`

- [ ] Advanced analytics
  - [ ] Support all pivot types
  - [ ] `get_campaign_performance` convenience method
  - [ ] Custom metric selection
  - [ ] Date range validation

- [ ] Testing
  - [ ] Unit tests for client wrapper
  - [ ] Integration tests (mock LinkedIn API)
  - [ ] Tool schema validation tests

---

### Phase 4: Polish & Release (Week 3-4)

**Goal:** Production-ready npm package.

#### Tasks

- [ ] Documentation
  - [ ] Comprehensive README
  - [ ] Setup guide with screenshots
  - [ ] Tool reference documentation
  - [ ] Troubleshooting guide

- [ ] npm publishing
  - [ ] Package.json metadata
  - [ ] npm publish workflow
  - [ ] Semantic versioning

- [ ] CI/CD
  - [ ] GitHub Actions for tests
  - [ ] Automated npm publish on release
  - [ ] Version bumping workflow

- [ ] Extras
  - [ ] CHANGELOG.md
  - [ ] CONTRIBUTING.md
  - [ ] MIT License

---

## User Setup Guide

### Prerequisites

1. A LinkedIn account with access to Campaign Manager
2. A LinkedIn Company Page (required for developer apps)
3. Node.js 18+ installed

### Step 1: Create LinkedIn Developer App

1. Go to [LinkedIn Developer Portal](https://developer.linkedin.com/)
2. Click **Create App**
3. Fill in:
   - App name: e.g., "My Campaign Manager MCP"
   - LinkedIn Page: Select your company page
   - App logo: Optional
4. Accept terms and create

### Step 2: Request Advertising API Access

1. In your app, go to **Products** tab
2. Find **Advertising API** and click **Request Access**
3. Fill out the access request form
4. Wait for approval (typically 1-3 business days)

### Step 3: Generate Access Token

1. Go to your app's **Auth** tab
2. Note your **Client ID** and **Client Secret**
3. Use LinkedIn's OAuth tools or a tool like Postman to generate a token with scopes:
   - `r_ads`
   - `rw_ads`
   - `r_ads_reporting`

**Token Expiry:** Access tokens expire after 60 days. You'll need to regenerate when expired.

### Step 4: Configure Claude Desktop

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

**Optional Configuration:**

```json
{
  "env": {
    "LINKEDIN_ACCESS_TOKEN": "your-token",
    "LINKEDIN_API_VERSION": "202601"
  }
}
```

### Step 5: Verify Setup

Restart Claude Desktop and try:
- "List my LinkedIn ad accounts"
- "Show campaigns in account [your-account-id]"

---

## Open Questions & Risks

### Open Questions

1. **Token refresh UX** - Should we implement local OAuth flow for easier token refresh, or is manual refresh acceptable for v1?

2. **Batch operations** - LinkedIn supports batch create/update. Worth implementing in v1 or defer?

3. **Image/video upload** - Creating image/video ads requires uploading media first. Include in scope?

4. **Conversion tracking** - LinkedIn has conversion tracking APIs. Include?

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| LinkedIn API changes | Breaking changes | Pin API version, monitor changelog, quick patch releases |
| Access token expiry | User frustration | Clear error messages, document refresh process, consider OAuth flow in v2 |
| Rate limiting | Tool failures | Exponential backoff, surface limits to user |
| API approval delays | Blocks user onboarding | Document timeline, provide sandbox testing guidance |
| linkedin-api-client instability | SDK bugs | Thin wrapper allows swapping, contribute fixes upstream |

---

## References

### LinkedIn Documentation

- [Marketing API Overview](https://learn.microsoft.com/en-us/linkedin/marketing/overview)
- [Campaign Management Getting Started](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads/getting-started)
- [OAuth 2.0 Authentication](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [API Rate Limits](https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/rate-limits)
- [API Versioning](https://learn.microsoft.com/en-us/linkedin/marketing/versioning)
- [Ads Reporting](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-reporting/ads-reporting)
- [Access Tiers](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/marketing-tiers)

### MCP Resources

- [MCP Specification](https://modelcontextprotocol.io/specification)
- [FastMCP Framework](https://github.com/punkpeye/fastmcp)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Server Best Practices 2026](https://www.cdata.com/blog/mcp-server-best-practices-2026)

### Code References

- [linkedin-api-client (Official SDK)](https://github.com/linkedin-developers/linkedin-api-js-client)
- [fredericbarthelet/linkedin-mcp-server](https://github.com/fredericbarthelet/linkedin-mcp-server)
- [tap-linkedin-ads](https://github.com/singer-io/tap-linkedin-ads)
- [LinkedIn Postman Collection](https://www.postman.com/linkedin-developer-apis/linkedin-marketing-solutions-versioned-apis/overview)
