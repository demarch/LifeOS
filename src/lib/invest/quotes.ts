import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { positions, quotesCache } from '@/db/schema';
import { fetchQuote } from './hg-client';
import { HgAuthError, HgRateLimitError } from './types';

interface PositionRow {
  ticker: string;
  assetClass: 'stock' | 'fii' | 'fixed_income';
}

export function selectTickersToFetch(rows: PositionRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.assetClass === 'fixed_income') continue;
    const t = r.ticker?.trim();
    if (!t) continue;
    set.add(t);
  }
  return Array.from(set);
}

export interface RefreshAllResult {
  refreshed: number;
  skipped: number;
  warnings: string[];
}

export async function refreshAll(): Promise<RefreshAllResult> {
  const rows = db.select({ ticker: positions.ticker, assetClass: positions.assetClass })
    .from(positions).all() as PositionRow[];
  const tickers = selectTickersToFetch(rows);
  const now = Math.floor(Date.now() / 1000);
  let refreshed = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (const ticker of tickers) {
    try {
      const quote = await fetchQuote(ticker);
      if (!quote) {
        warnings.push(`HG: ticker ${ticker} not found`);
        skipped++;
        continue;
      }

      const existing = db.select().from(quotesCache).where(eq(quotesCache.ticker, ticker)).get();
      if (existing) {
        db.update(quotesCache).set({
          price: quote.price,
          changePercent: quote.changePercent,
          fetchedAt: now,
        }).where(eq(quotesCache.ticker, ticker)).run();
      } else {
        db.insert(quotesCache).values({
          ticker,
          price: quote.price,
          changePercent: quote.changePercent,
          fetchedAt: now,
        }).run();
      }

      const matchingPositions = db.select().from(positions).where(eq(positions.ticker, ticker)).all();
      for (const pos of matchingPositions) {
        if (pos.assetClass === 'fixed_income') continue;
        db.update(positions).set({
          lastQuote: quote.price,
          lastQuoteAt: now,
          currentValue: pos.quantity * quote.price,
          updatedAt: now,
        }).where(eq(positions.id, pos.id)).run();
      }
      refreshed++;
    } catch (err) {
      if (err instanceof HgAuthError || err instanceof HgRateLimitError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`HG: ${ticker} failed (${msg})`);
      skipped++;
    }
  }

  return { refreshed, skipped, warnings };
}
