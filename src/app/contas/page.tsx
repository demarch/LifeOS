import { db } from '@/db/client';
import { bills } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { BillsList } from '@/components/pages/contas/bills-list';
import { fmt } from '@/lib/fmt';

export default function ContasPage() {
  const allBills = db.select().from(bills).orderBy(asc(bills.dueDay)).all();
  const totalOpen = allBills.filter(b => !b.isPaid).reduce((s, b) => s + (b.amount ?? 0), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Contas a pagar</h1>
          <div className="sub">
            {allBills.filter(b => !b.isPaid).length} em aberto · total{' '}
            <span className="mask" style={{ color: 'var(--text-0)', fontFamily: 'var(--font-mono)' }}>
              {fmt(totalOpen)}
            </span>
          </div>
        </div>
        <div className="right">
          <button className="btn">
            <span style={{ fontSize: 13 }}>+ Adicionar conta</span>
          </button>
        </div>
      </div>

      <BillsList initialBills={allBills} />
    </>
  );
}
