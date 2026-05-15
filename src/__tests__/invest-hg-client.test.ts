import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchQuote } from '@/lib/invest/hg-client';
import { HgAuthError, HgRateLimitError } from '@/lib/invest/types';
import petr4 from '@/lib/invest/__fixtures__/hg-stock-petr4.json';
import notFound from '@/lib/invest/__fixtures__/hg-ticker-not-found.json';

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.HG_BRASIL_KEY = 'test-key';
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
});

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  ) as unknown as typeof fetch;
}

describe('fetchQuote', () => {
  it('parses price and change_percent for a valid ticker', async () => {
    mockFetchOnce(200, petr4);
    const quote = await fetchQuote('PETR4');
    expect(quote).toEqual({ ticker: 'PETR4', price: 38.4, changePercent: 1.23 });
  });

  it('returns null when the ticker is reported as not found by HG', async () => {
    mockFetchOnce(200, notFound);
    const quote = await fetchQuote('XYZW9');
    expect(quote).toBeNull();
  });

  it('throws HgAuthError on status 401', async () => {
    mockFetchOnce(401, { error: true, message: 'invalid key' });
    await expect(fetchQuote('PETR4')).rejects.toBeInstanceOf(HgAuthError);
  });

  it('throws HgRateLimitError on status 429', async () => {
    mockFetchOnce(429, { error: true, message: 'rate limit' });
    await expect(fetchQuote('PETR4')).rejects.toBeInstanceOf(HgRateLimitError);
  });

  it('retries once on network failure before propagating the error', async () => {
    let calls = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) return Promise.reject(new Error('network down'));
      return Promise.resolve(new Response(JSON.stringify(petr4), { status: 200 }));
    }) as unknown as typeof fetch;
    const quote = await fetchQuote('PETR4');
    expect(calls).toBe(2);
    expect(quote?.price).toBe(38.4);
  });
});
