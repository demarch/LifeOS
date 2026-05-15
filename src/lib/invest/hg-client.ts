import { HgAuthError, HgRateLimitError, type HgQuote } from './types';

const ENDPOINT = 'https://api.hgbrasil.com/finance/stock_price';
const RETRY_DELAY_MS = 500;

interface HgRawResult {
  results?: Record<string, {
    price?: number;
    change_percent?: number;
    error?: boolean;
    message?: string;
  }>;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchQuote(ticker: string): Promise<HgQuote | null> {
  const key = process.env.HG_BRASIL_KEY;
  if (!key) throw new HgAuthError('HG_BRASIL_KEY is not set');

  const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&symbol=${encodeURIComponent(ticker)}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 401) throw new HgAuthError();
      if (res.status === 429) throw new HgRateLimitError();
      if (!res.ok) throw new Error(`HG Brasil HTTP ${res.status}`);
      const body = (await res.json()) as HgRawResult;
      const entry = body.results?.[ticker];
      if (!entry || entry.error) return null;
      if (typeof entry.price !== 'number') return null;
      return {
        ticker,
        price: entry.price,
        changePercent: typeof entry.change_percent === 'number' ? entry.change_percent : null,
      };
    } catch (err) {
      if (err instanceof HgAuthError || err instanceof HgRateLimitError) throw err;
      lastErr = err;
      if (attempt === 0) await delay(RETRY_DELAY_MS);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('HG Brasil request failed');
}
