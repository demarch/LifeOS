import { db } from '@/db/client';
import { accounts, transactions, bills, cashFlowMonths, cashFlowEntries } from '@/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { KpiGrid } from '@/components/pages/home/kpi-grid';
import { RecentActivity } from '@/components/pages/home/recent-activity';
import { CalendarStrip } from '@/components/pages/home/calendar-strip';
import { CashFlowForecast } from '@/components/pages/home/cashflow-forecast';
import { CategoryAllocation } from '@/components/pages/home/category-allocation';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const allAccounts = db.select().from(accounts).all();
  const allTransactions = db.select().from(transactions).orderBy(desc(transactions.date)).all();
  const allBills = db.select().from(bills).all();

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const horizon = new Date(now);
  horizon.setDate(now.getDate() + 30);
  const isoOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayIso = isoOf(now);
  const horizonIso = isoOf(horizon);
  const forecastMonthKeys = Array.from(new Set([todayIso.slice(0, 7), horizonIso.slice(0, 7)]));
  const forecastMonths = db
    .select()
    .from(cashFlowMonths)
    .where(inArray(cashFlowMonths.key, forecastMonthKeys))
    .all();
  const forecastMonthIds = forecastMonths.map(m => m.id);
  const forecastEntries = forecastMonthIds.length
    ? db
        .select()
        .from(cashFlowEntries)
        .where(inArray(cashFlowEntries.monthId, forecastMonthIds))
        .all()
        .filter(e => e.date >= todayIso && e.date <= horizonIso)
    : [];

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Bom dia' : today.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const dateStr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting} 👋</h1>
          <div className="sub">{dateStr}</div>
        </div>
      </div>

      <KpiGrid accounts={allAccounts} bills={allBills} transactions={allTransactions} />

      <div className="two-col">
        <RecentActivity transactions={allTransactions} accounts={allAccounts} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-no-pad">
            <div className="card-head">
              <h2>Próximos 7 dias</h2>
            </div>
            <div className="card-pad">
              <CalendarStrip bills={allBills} />
            </div>
          </div>
          <div className="card card-no-pad">
            <div className="card-head">
              <h2>Fluxo previsto (30 dias)</h2>
            </div>
            <div className="card-pad">
              <CashFlowForecast entries={forecastEntries} />
            </div>
          </div>
          <CategoryAllocation transactions={allTransactions} />
        </div>
      </div>
    </>
  );
}
