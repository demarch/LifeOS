import { desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { positions, portfolioSnapshots } from '@/db/schema';
import { aggregateByClass, computeTotalCost } from '@/lib/invest/snapshot';
import type { AssetClass } from '@/lib/invest/types';
import { InvestShell } from '@/components/pages/invest/invest-shell';

export const dynamic = 'force-dynamic';

export default function InvestPage() {
  const posRows = db.select().from(positions).orderBy(desc(positions.currentValue)).all();
  const snaps = db.select().from(portfolioSnapshots).orderBy(desc(portfolioSnapshots.snapshotDate)).limit(12).all();

  const totals = aggregateByClass(posRows.map(p => ({ assetClass: p.assetClass as AssetClass, currentValue: p.currentValue })));
  const totalCost = computeTotalCost(posRows);
  const lastSnapshotDate = snaps[0]?.snapshotDate ?? null;

  return (
    <InvestShell
      positions={posRows}
      snapshots={snaps}
      totals={totals}
      totalCost={totalCost}
      lastSnapshotDate={lastSnapshotDate}
    />
  );
}
