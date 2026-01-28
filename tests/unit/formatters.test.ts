import { describe, it, expect } from 'vitest';
import {
  extractIdFromUrn,
  buildUrn,
  formatAdAccount,
  formatCampaign,
  formatMoneyAmount,
  dateToEpochMs,
  epochMsToIso,
  buildMoneyAmount,
} from '../../src/utils/formatters.js';

/**
 * Tests for our formatting/transformation utilities.
 *
 * These tests verify OUR business logic for transforming LinkedIn API
 * responses into our standardized format. We're NOT testing LinkedIn's
 * API or the linkedin-api-client library.
 */

describe('extractIdFromUrn', () => {
  it('extracts numeric ID from sponsoredAccount URN', () => {
    expect(extractIdFromUrn('urn:li:sponsoredAccount:123456789')).toBe('123456789');
  });

  it('extracts ID from sponsoredCampaign URN', () => {
    expect(extractIdFromUrn('urn:li:sponsoredCampaign:987654321')).toBe('987654321');
  });

  it('handles URNs with multiple colons', () => {
    expect(extractIdFromUrn('urn:li:some:nested:type:12345')).toBe('12345');
  });
});

describe('buildUrn', () => {
  it('builds sponsoredAccount URN', () => {
    expect(buildUrn('sponsoredAccount', '123456')).toBe('urn:li:sponsoredAccount:123456');
  });

  it('builds sponsoredCampaign URN', () => {
    expect(buildUrn('sponsoredCampaign', '789')).toBe('urn:li:sponsoredCampaign:789');
  });
});

describe('formatAdAccount', () => {
  it('transforms raw LinkedIn ad account response to our format', () => {
    const rawAccount = {
      id: 'urn:li:sponsoredAccount:123456',
      name: 'Test Account',
      status: 'ACTIVE',
      currency: 'USD',
      type: 'BUSINESS',
    };

    const formatted = formatAdAccount(rawAccount);

    expect(formatted).toEqual({
      id: '123456',
      name: 'Test Account',
      status: 'ACTIVE',
      currency: 'USD',
      type: 'BUSINESS',
    });
  });

  it('extracts ID correctly even with long URN', () => {
    const rawAccount = {
      id: 'urn:li:sponsoredAccount:999888777666',
      name: 'Long ID Account',
      status: 'PAUSED',
      currency: 'EUR',
      type: 'ENTERPRISE',
    };

    const formatted = formatAdAccount(rawAccount);

    expect(formatted.id).toBe('999888777666');
  });
});

describe('formatCampaign', () => {
  it('transforms raw campaign with all fields', () => {
    const rawCampaign = {
      id: 'urn:li:sponsoredCampaign:456789',
      name: 'Summer Sale Campaign',
      status: 'ACTIVE',
      objectiveType: 'WEBSITE_VISITS',
      costType: 'CPC',
      dailyBudget: {
        amount: '50.00',
        currencyCode: 'USD',
      },
      totalSpend: {
        amount: '125.50',
        currencyCode: 'USD',
      },
    };

    const formatted = formatCampaign(rawCampaign);

    expect(formatted).toEqual({
      id: '456789',
      name: 'Summer Sale Campaign',
      status: 'ACTIVE',
      objectiveType: 'WEBSITE_VISITS',
      costType: 'CPC',
      dailyBudget: {
        amount: '50.00',
        currencyCode: 'USD',
      },
      totalSpend: {
        amount: '125.50',
        currencyCode: 'USD',
      },
    });
  });

  it('handles campaign without optional budget fields', () => {
    const rawCampaign = {
      id: 'urn:li:sponsoredCampaign:111',
      name: 'Draft Campaign',
      status: 'DRAFT',
      objectiveType: 'BRAND_AWARENESS',
      costType: 'CPM',
    };

    const formatted = formatCampaign(rawCampaign);

    expect(formatted.dailyBudget).toBeUndefined();
    expect(formatted.totalSpend).toBeUndefined();
  });
});

describe('formatMoneyAmount', () => {
  it('formats money amount object', () => {
    const raw = { amount: '100.00', currencyCode: 'USD' };
    expect(formatMoneyAmount(raw)).toEqual({
      amount: '100.00',
      currencyCode: 'USD',
    });
  });
});

describe('buildMoneyAmount', () => {
  it('builds money amount with default USD currency', () => {
    const result = buildMoneyAmount(50);
    expect(result).toEqual({
      amount: '50',
      currencyCode: 'USD',
    });
  });

  it('builds money amount with specified currency', () => {
    const result = buildMoneyAmount(100, 'EUR');
    expect(result).toEqual({
      amount: '100',
      currencyCode: 'EUR',
    });
  });

  it('converts decimal amounts to string', () => {
    const result = buildMoneyAmount(99.99);
    expect(result.amount).toBe('99.99');
  });
});

describe('date utilities', () => {
  describe('dateToEpochMs', () => {
    it('converts YYYY-MM-DD to epoch milliseconds at midnight UTC', () => {
      const epoch = dateToEpochMs('2026-01-28');
      const date = new Date(epoch);

      expect(date.getUTCFullYear()).toBe(2026);
      expect(date.getUTCMonth()).toBe(0); // January is 0
      expect(date.getUTCDate()).toBe(28);
      expect(date.getUTCHours()).toBe(0);
    });
  });

  describe('epochMsToIso', () => {
    it('converts epoch milliseconds to YYYY-MM-DD', () => {
      // 2026-01-28 00:00:00 UTC
      const epoch = Date.UTC(2026, 0, 28);
      expect(epochMsToIso(epoch)).toBe('2026-01-28');
    });
  });
});
