import { db } from '@/db/client';
import { cashFlowMonths, cashFlowEntries, transactions } from '@/db/schema';
import { asc, desc, inArray } from 'drizzle-orm';
import { CashFlowShell } from '@/components/pages/fluxo/cash-flow-shell';

export const dynamic = 'force-dynamic';

interface FluxoPageProps {
  searchParams?: { month?: string };
}

export default function FluxoPage({ searchParams }: FluxoPageProps) {
  const months = db.select().from(cashFlowMonths).orderBy(desc(cashFlowMonths.key)).all();
  const monthIds = months.map(m => m.id);
  const entries = monthIds.length
    ? db.select().from(cashFlowEntries).where(inArray(cashFlowEntries.monthId, monthIds)).orderBy(asc(cashFlowEntries.day)).all()
    : [];
  const monthKeys = months.map(m => m.key);
  const realTx = monthKeys.length
    ? db.select().from(transactions).all().filter(t => monthKeys.some(k => t.date.startsWith(k)))
    : [];

  const requestedKey = searchParams?.month;
  const initialMonthId = requestedKey
    ? months.find(m => m.key === requestedKey)?.id ?? null
    : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fluxo de Caixa</h1>
          <div className="sub">Planejamento mensal e comparação plano × real</div>
        </div>
      </div>
      <CashFlowShell
        initialMonths={months}
        initialEntries={entries}
        realTransactions={realTx}
        initialMonthId={initialMonthId}
      />
    </>
  );
}
