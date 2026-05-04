import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { AccountChips } from '@/components/pages/financas/account-chips';
import { TransactionsTable } from '@/components/pages/financas/transactions-table';
import { fmt } from '@/lib/fmt';

export default function FinancasPage() {
  const allAccounts = db.select().from(accounts).all();
  const allTransactions = db.select().from(transactions).orderBy(desc(transactions.date)).all();
  const totalBalance = allAccounts
    .filter(a => a.type === 'checking')
    .reduce((s, a) => s + a.balance, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Finanças</h1>
          <div className="sub">Contas e movimentações</div>
        </div>
        <div className="right">
          <span className="num mask" style={{ fontSize: 22, fontWeight: 700 }}>
            {fmt(totalBalance)}
          </span>
          <span className="sub" style={{ marginLeft: 8 }}>saldo total</span>
        </div>
      </div>

      <AccountChips accounts={allAccounts} />
      <TransactionsTable transactions={allTransactions} accounts={allAccounts} />
    </>
  );
}
