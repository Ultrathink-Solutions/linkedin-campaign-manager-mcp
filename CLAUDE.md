# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides full CRUD access to LinkedIn Campaign Manager and Community Management APIs. It uses FastMCP as the server framework and the official `linkedin-api-client` library.

## Commands

```bash
# Build
npm run build

# Run tests
npm test
npm run test:watch      # watch mode
npm run test:coverage   # with coverage (80% threshold)

# Linting & formatting
npm run lint
npm run lint:fix
npm run format
npm run format:check

# Type checking
npm run typecheck

# Run the server (after build)
npm start

# Generate OAuth token (opens browser)
npm run auth
```

## Architecture

### Dual-Client Pattern

The server supports two separate LinkedIn API clients due to LinkedIn's "one product per app" restriction:

1. **Primary Client** (`LINKEDIN_ACCESS_TOKEN`) - Handles Advertising API + Share on LinkedIn
2. **Community Client** (`LINKEDIN_COMMUNITY_TOKEN`) - Handles Community Management API (organization analytics)

The community client is optional; if not configured, organization analytics tools return a helpful error message explaining setup requirements.

### Tool Registration Pattern

Each tool module exports a tools object following this pattern:

```typescript
export const campaignTools = {
  list_campaigns: {
    description: 'Human-readable description',
    parameters: ZodSchema,  // Input validation schema
    handler: async (input: unknown, client: LinkedInClient) => Promise<string>,
  },
};
```

Tools are registered in `src/index.ts` by iterating over these exports. The handler receives the validated input and a LinkedInClient instance.

### Type System

- All tool inputs are validated with Zod schemas defined in `src/types.ts`
- Response types (`*Summary` interfaces) define our formatted output structure
- LinkedIn URNs are extracted to simple IDs in responses via `formatters.ts`
- API responses are validated with Zod before transformation (see `formatPost` for the pattern)

### Error Handling

`src/errors.ts` provides a custom error hierarchy:
- `LinkedInApiError` - Base class with `toUserMessage()` for friendly errors
- `AuthenticationError`, `PermissionError`, `RateLimitError` - Specific API errors
- `ValidationError` - For our validation failures (not LinkedIn's)

The `transformError()` function converts axios-style errors from the LinkedIn client to our error types. The `LinkedInClient` wrapper includes automatic retry with exponential backoff for rate limit errors.

### LinkedIn API Specifics

- API version is configurable via `LINKEDIN_API_VERSION` (default: `202601`)
- Campaigns are archived, not deleted (LinkedIn doesn't support hard delete)
- Organization IDs must be numeric strings without URN prefix
- Date parameters use `YYYY-MM-DD` format, converted internally to epoch milliseconds
