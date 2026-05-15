'use client';
import type { Position, PortfolioSnapshot } from '@/db/schema';
import type { ClassTotals } from '@/lib/invest/types';
import { KpiCards } from './kpi-cards';
import { PositionsTable } from './positions-table';
import { AllocationPie } from './allocation-pie';
import { EvolutionLine } from './evolution-line';
import { RefreshButton } from './refresh-button';

interface InvestShellProps {
  positions: Position[];
  snapshots: PortfolioSnapshot[];
  totals: ClassTotals;
  totalCost: number;
  lastSnapshotDate: string | null;
}

export function InvestShell({ positions, snapshots, totals, totalCost, lastSnapshotDate }: InvestShellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Investimentos</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
            Última: {lastSnapshotDate ?? '—'}
          </span>
          <RefreshButton />
        </div>
      </header>

      <KpiCards totals={totals} totalCost={totalCost} />

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>Alocação</div>
          <AllocationPie totals={totals} />
        </div>
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>Evolução</div>
          <EvolutionLine snapshots={snapshots} />
        </div>
      </section>

      <section style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>Posições</div>
        <PositionsTable positions={positions} total={totals.total} />
      </section>
    </div>
  );
}
