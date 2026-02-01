import { z } from 'zod';
import {
  PostVisibility,
  PostLifecycleState,
  type AdAccountSummary,
  type CampaignSummary,
  type CampaignGroupSummary,
  type CreativeSummary,
  type MoneyAmount,
  type PostSummary,
} from '../types.js';
import { ValidationError } from '../errors.js';

/**
 * Extract the numeric ID from a LinkedIn URN
 * e.g., "urn:li:sponsoredAccount:123456" -> "123456"
 */
export function extractIdFromUrn(urn: string): string {
  const parts = urn.split(':');
  return parts[parts.length - 1];
}

/**
 * Build a LinkedIn URN from a type and ID
 * e.g., ("sponsoredAccount", "123456") -> "urn:li:sponsoredAccount:123456"
 */
export function buildUrn(type: string, id: string): string {
  return `urn:li:${type}:${id}`;
}

/**
 * Format a raw LinkedIn ad account response into our summary format
 */
export function formatAdAccount(raw: Record<string, unknown>): AdAccountSummary {
  return {
    id: extractIdFromUrn(raw.id as string),
    name: raw.name as string,
    status: raw.status as string,
    currency: raw.currency as string,
    type: raw.type as string,
  };
}

/**
 * Format a raw LinkedIn campaign response into our summary format
 */
export function formatCampaign(raw: Record<string, unknown>): CampaignSummary {
  const dailyBudget = raw.dailyBudget as Record<string, unknown> | undefined;
  const totalSpend = raw.totalSpend as Record<string, unknown> | undefined;

  return {
    id: extractIdFromUrn(raw.id as string),
    name: raw.name as string,
    status: raw.status as string,
    objectiveType: raw.objectiveType as string,
    costType: raw.costType as string,
    dailyBudget: dailyBudget ? formatMoneyAmount(dailyBudget) : undefined,
    totalSpend: totalSpend ? formatMoneyAmount(totalSpend) : undefined,
  };
}

/**
 * Format a raw LinkedIn campaign group response into our summary format
 */
export function formatCampaignGroup(raw: Record<string, unknown>): CampaignGroupSummary {
  const totalBudget = raw.totalBudget as Record<string, unknown> | undefined;

  return {
    id: extractIdFromUrn(raw.id as string),
    name: raw.name as string,
    status: raw.status as string,
    totalBudget: totalBudget ? formatMoneyAmount(totalBudget) : undefined,
  };
}

/**
 * Format a raw LinkedIn creative response into our summary format
 */
export function formatCreative(raw: Record<string, unknown>): CreativeSummary {
  const variables = raw.variables as Record<string, unknown> | undefined;
  const data = variables?.data as Record<string, unknown> | undefined;
  const textAdVars = data?.['com.linkedin.ads.TextAdCreativeVariables'] as
    | Record<string, unknown>
    | undefined;

  return {
    id: extractIdFromUrn(raw.id as string),
    campaignId: extractIdFromUrn(raw.campaign as string),
    type: raw.type as string,
    status: raw.status as string,
    title: textAdVars?.title as string | undefined,
    text: textAdVars?.text as string | undefined,
  };
}

/**
 * Format a raw money amount
 */
export function formatMoneyAmount(raw: Record<string, unknown>): MoneyAmount {
  return {
    amount: raw.amount as string,
    currencyCode: raw.currencyCode as string,
  };
}

/**
 * Parse an ISO date string to epoch milliseconds
 */
export function isoToEpochMs(isoDate: string): number {
  return new Date(isoDate).getTime();
}

/**
 * Format epoch milliseconds to ISO date string
 */
export function epochMsToIso(epochMs: number): string {
  return new Date(epochMs).toISOString().split('T')[0];
}

/**
 * Format a date string (YYYY-MM-DD) to LinkedIn's expected epoch format
 */
export function dateToEpochMs(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getTime();
}

/**
 * Build currency-aware money amount object for LinkedIn API
 */
export function buildMoneyAmount(amount: number, currencyCode: string = 'USD'): Record<string, unknown> {
  return {
    amount: amount.toString(),
    currencyCode,
  };
}

/**
 * Zod schema for validating LinkedIn post API response
 */
const LinkedInPostResponseSchema = z.object({
  id: z.string(),
  author: z.string().optional(),
  commentary: z.string().optional(),
  visibility: PostVisibility.optional(),
  lifecycleState: PostLifecycleState.optional(),
  createdAt: z.number().optional(),
  publishedAt: z.number().optional(),
  lastModifiedAt: z.number().optional(),
});

/**
 * Format a raw LinkedIn post response into our summary format
 */
export function formatPost(raw: Record<string, unknown>): PostSummary {
  const parseResult = LinkedInPostResponseSchema.safeParse(raw);

  if (!parseResult.success) {
    throw new ValidationError(
      `Invalid post response from LinkedIn API: ${parseResult.error.message}`,
      'postResponse',
      parseResult.error.issues
    );
  }

  const validated = parseResult.data;

  return {
    id: extractIdFromUrn(validated.id),
    urn: validated.id,
    author: validated.author ?? '',
    text: validated.commentary ?? '',
    visibility: validated.visibility ?? 'PUBLIC',
    lifecycleState: validated.lifecycleState ?? 'PUBLISHED',
    createdAt: validated.createdAt !== undefined ? epochMsToIso(validated.createdAt) : undefined,
    publishedAt: validated.publishedAt !== undefined ? epochMsToIso(validated.publishedAt) : undefined,
    lastModifiedAt: validated.lastModifiedAt !== undefined ? epochMsToIso(validated.lastModifiedAt) : undefined,
  };
}
