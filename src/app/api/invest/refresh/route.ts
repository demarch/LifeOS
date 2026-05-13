import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/invest/config';
import { syncPositions } from '@/lib/invest/pluggy-invest';
import { refreshAll } from '@/lib/invest/quotes';
import { persistToday } from '@/lib/invest/snapshot';
import { HgAuthError, HgRateLimitError } from '@/lib/invest/types';

export const dynamic = 'force-dynamic';

export async function POST() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'config error', code: 'CONFIG' },
      { status: 500 }
    );
  }

  const sync = await syncPositions(config.pluggyItemIds);

  let quotes;
  try {
    quotes = await refreshAll();
  } catch (err) {
    if (err instanceof HgAuthError) {
      return NextResponse.json({ ok: false, error: err.message, code: 'HG_AUTH' }, { status: 500 });
    }
    if (err instanceof HgRateLimitError) {
      return NextResponse.json({ ok: false, error: err.message, code: 'HG_RATE_LIMIT' }, { status: 503 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, code: 'HG_UNKNOWN' }, { status: 500 });
  }

  const snap = await persistToday();

  return NextResponse.json({
    ok: true,
    syncedPositions: sync.synced,
    refreshedQuotes: quotes.refreshed,
    skippedQuotes: quotes.skipped,
    snapshotDate: snap.snapshotDate,
    warnings: [...sync.errors, ...quotes.warnings],
  });
}
