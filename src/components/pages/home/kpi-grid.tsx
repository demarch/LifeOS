'use client';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/atoms/icon';
import { SparkBars } from '@/components/atoms/spark-bars';
import { fmt } from '@/lib/fmt';
import { daysUntilDue } from '@/lib/dates';
import type { Account, Bill, Transaction } from '@/db/schema';

interface KpiGridProps {
  accounts: Account[];
  bills: Bill[];
  transactions: Transaction[];
}

export function KpiGrid({ accounts, bills, transactions }: KpiGridProps) {
  const router = useRouter();

  const totalBalance = accounts
    .filter(a => a.type === 'checking')
    .reduce((s, a) => s + a.balance, 0);
  const investedBalance = accounts
    .filter(a => a.type === 'investment')
    .reduce((s, a) => s + a.balance, 0);

  const month = new Date().toISOString().slice(0, 7);
  const monthOut = transactions
    .filter(t => t.amount < 0 && t.type !== 'transfer' && t.date.startsWith(month))
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthIn = transactions
    .filter(t => t.amount > 0 && t.type !== 'transfer' && t.date.startsWith(month))
    .reduce((s, t) => s + t.amount, 0) || 1;

  const unpaid = bills.filter(b => !b.isPaid);
  const urgent = unpaid.filter(b => daysUntilDue(b.dueDay) <= 3).length;
  const next = [...unpaid].sort((a, b) => daysUntilDue(a.dueDay) - daysUntilDue(b.dueDay))[0];

  return (
    <div className="kpi-grid">
      <div className="kpi accent" onClick={() => router.push('/financas')}>
        <div className="label">
          Saldo total
          <span className="ic-wrap" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Icon name="wallet" size={14} />
          </span>
        </div>
        <div className="num mask">{fmt(totalBalance)}</div>
        <div className="delta" style={{ color: 'var(--text-2)', fontSize: 11.5 }}>
          {investedBalance > 0
            ? <span className="mask">+ {fmt(investedBalance)} investido</span>
            : `${accounts.filter(a => a.type === 'checking').length} conta(s) corrente`}
        </div>
        <div className="footer">
          <span>{accounts.filter(a => a.type !== 'investment').length} contas</span>
          <Icon name="chevron" size={12} color="var(--text-3)" />
        </div>
      </div>

      <div className="kpi danger" onClick={() => router.push('/contas')}>
        <div className="label">
          Alertas
          <span className="ic-wrap" style={{ background: 'color-mix(in oklch, var(--danger) 18%, transparent)', color: 'var(--danger)' }}>
            <Icon name="bell" size={14} />
          </span>
        </div>
        <div className="num">{urgent}</div>
        <div className="delta" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
          {next ? `${next.name} · dia ${next.dueDay}` : 'Nenhuma conta urgente'}
        </div>
        <div className="footer">
          <span>{unpaid.length} em aberto</span>
          <Icon name="chevron" size={12} color="var(--text-3)" />
        </div>
      </div>

      <div className="kpi good" onClick={() => router.push('/financas')}>
        <div className="label">
          Gastos · {new Date().toLocaleDateString('pt-BR', { month: 'short' })}
          <span className="ic-wrap" style={{ background: 'color-mix(in oklch, var(--good) 18%, transparent)', color: 'var(--good)' }}>
            <Icon name="arrowDown" size={14} />
          </span>
        </div>
        <div className="num mask">{fmt(monthOut)}</div>
        <div className="delta" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
          de {fmt(monthIn)} de entradas
        </div>
        <div className="footer">
          <div className="bar" style={{ flex: 1, marginRight: 8 }}>
            <span style={{ width: `${Math.min((monthOut / monthIn) * 100, 100)}%`, background: 'var(--good)' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {Math.round((monthOut / monthIn) * 100)}%
          </span>
        </div>
      </div>

      <div className="kpi warn" onClick={() => router.push('/contas')}>
        <div className="label">
          Próx. conta
          <span className="ic-wrap" style={{ background: 'color-mix(in oklch, var(--warn) 18%, transparent)', color: 'var(--warn)' }}>
            <Icon name="calendar" size={14} />
          </span>
        </div>
        <div className="num" style={{ fontSize: next ? 20 : 26 }}>
          {next ? next.name : '—'}
        </div>
        <div className="delta" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
          {next ? `dia ${next.dueDay} · ${fmt(next.amount ?? 0)}` : 'Nenhuma conta pendente'}
        </div>
        <div className="footer">
          {next
            ? <><span>em {daysUntilDue(next.dueDay)} dia(s)</span><SparkBars values={[3,5,2,7,4,6,8]} /></>
            : <span>—</span>
          }
        </div>
      </div>
    </div>
  );
}
