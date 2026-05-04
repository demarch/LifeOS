import { db } from '@/db/client';
import { accounts, transactions, bills } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { KpiGrid } from '@/components/pages/home/kpi-grid';
import { RecentActivity } from '@/components/pages/home/recent-activity';
import { CalendarStrip } from '@/components/pages/home/calendar-strip';
import { CategoryAllocation } from '@/components/pages/home/category-allocation';

export default function HomePage() {
  const allAccounts = db.select().from(accounts).all();
  const allTransactions = db.select().from(transactions).orderBy(desc(transactions.date)).all();
  const allBills = db.select().from(bills).all();

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
          <CategoryAllocation transactions={allTransactions} />
        </div>
      </div>
    </>
  );
}
