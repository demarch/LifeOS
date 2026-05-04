import { Icon } from '@/components/atoms/icon';
import { fmt } from '@/lib/fmt';
import { dayLabel } from '@/lib/dates';
import type { Account, Transaction } from '@/db/schema';

interface RecentActivityProps {
  transactions: Transaction[];
  accounts: Account[];
}

export function RecentActivity({ transactions, accounts }: RecentActivityProps) {
  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <div className="card card-no-pad">
      <div className="card-head">
        <h2>Atividade recente</h2>
        <span className="sub">últimas 6 transações</span>
      </div>
      <div className="list">
        {recent.length === 0 && (
          <div className="row" style={{ color: 'var(--text-3)', justifyContent: 'center' }}>
            Nenhuma transação — sincronize primeiro
          </div>
        )}
        {recent.map(t => {
          const acct = accounts.find(a => a.id === t.accountId);
          return (
            <div className="row" key={t.id}>
              <div className="lead">
                {t.amount > 0
                  ? <Icon name="arrowDown" size={14} color="var(--good)" />
                  : <Icon name="arrowUp" size={14} color="var(--text-2)" />}
              </div>
              <div className="body">
                <div className="title">{t.description}</div>
                <div className="sub">
                  <span style={{ color: acct?.color }}>● {acct?.bank ?? '—'}</span>
                  <span>·</span>
                  <span>{t.category || 'Sem categoria'}</span>
                  <span>·</span>
                  <span>{dayLabel(t.date)}</span>
                </div>
              </div>
              <div className={`amt ${t.amount > 0 ? 'in' : 'out'} mask`}>
                {fmt(t.amount, { signed: true })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
