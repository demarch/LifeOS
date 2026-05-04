'use client';
import { useState } from 'react';
import { Icon } from '@/components/atoms/icon';
import { Tag } from '@/components/atoms/tag';
import { fmt } from '@/lib/fmt';
import { daysUntilDue, billTone } from '@/lib/dates';
import type { Bill } from '@/db/schema';

interface BillsListProps {
  initialBills: Bill[];
}

type Tab = 'open' | 'paid' | 'review' | 'all';

export function BillsList({ initialBills }: BillsListProps) {
  const [bills, setBills] = useState(initialBills);
  const [tab, setTab] = useState<Tab>('open');

  const open   = bills.filter(b => !b.isPaid);
  const paid   = bills.filter(b => b.isPaid);
  const review = bills.filter(b => b.needsReview && !b.isPaid);

  const tabBills = tab === 'open' ? open : tab === 'paid' ? paid : tab === 'review' ? review : bills;
  const sorted = [...tabBills].sort((a, b) => daysUntilDue(a.dueDay) - daysUntilDue(b.dueDay));
  const totalOpen = open.reduce((s, b) => s + (b.amount ?? 0), 0);

  const togglePaid = async (bill: Bill) => {
    const next = !bill.isPaid;
    await fetch(`/api/bills/${bill.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPaid: next }),
    });
    setBills(bs => bs.map(b => b.id === bill.id ? { ...b, isPaid: next ? 1 : 0 } : b));
  };

  const addBill = async () => {
    const name = prompt('Nome da conta:');
    if (!name) return;
    const amountStr = prompt('Valor (deixe vazio se desconhecido):');
    const dayStr = prompt('Dia do vencimento (1-31):');
    if (!dayStr) return;

    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        amount: amountStr ? parseFloat(amountStr) : null,
        dueDay: parseInt(dayStr),
        category: 'Outros',
      }),
    });
    const { id } = await res.json();
    setBills(bs => [...bs, {
      id, name, amount: amountStr ? parseFloat(amountStr) : null,
      dueDay: parseInt(dayStr), category: 'Outros', source: 'manual',
      isPaid: 0, paidAt: null, needsReview: 0,
      createdAt: Math.floor(Date.now() / 1000),
    }]);
  };

  return (
    <>
      {review.length > 0 && (
        <div className="hint">
          <span className="ic"><Icon name="bot" size={16} color="var(--accent)" /></span>
          <span>
            <b style={{ color: 'var(--text-0)' }}>{review.length} conta(s) auto-detectada(s)</b>{' '}
            aguardando revisão.
          </span>
          <div className="actions">
            <button className="btn ghost" onClick={() => setTab('review')}>Revisar</button>
          </div>
        </div>
      )}

      <div className="tabs">
        {([['open', 'Em aberto', open.length], ['paid', 'Pagas', paid.length], ['review', 'Auto-detectadas', review.length], ['all', 'Todas', bills.length]] as const).map(
          ([id, label, count]) => (
            <div
              key={id}
              className={`tab${tab === id ? ' active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}<span className="count">{count}</span>
            </div>
          )
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.length === 0 && (
          <div style={{ color: 'var(--text-3)', padding: 12, fontSize: 13 }}>
            Nenhuma conta nesta aba.
          </div>
        )}
        {sorted.map(b => {
          const tone = billTone(b.dueDay, !!b.isPaid);
          const days = daysUntilDue(b.dueDay);
          return (
            <div key={b.id} className={`bill ${tone}`}>
              <div className="due">
                <span className="day">{String(b.dueDay).padStart(2, '0')}</span>
                <span className="mo">{new Date().toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
              </div>
              <div className="body">
                <div className="name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {b.name}
                  {b.source === 'auto' && !b.needsReview && <Tag tone="info" icon="bot">auto</Tag>}
                  {!!b.needsReview && <Tag tone="warn">revisar</Tag>}
                  {!!b.isPaid && <Tag tone="good" icon="check">pago</Tag>}
                </div>
                <div className="meta">
                  <span>{b.category}</span>
                  <span>·</span>
                  <span>
                    {b.isPaid ? 'pago'
                      : days === 0 ? 'vence hoje'
                      : days === 1 ? 'vence amanhã'
                      : `vence em ${days} dias`}
                  </span>
                </div>
              </div>
              <div className="amt mask">{fmt(b.amount ?? 0)}</div>
              <button className="pay-btn" onClick={() => togglePaid(b)}>
                {b.isPaid
                  ? <><Icon name="check" size={12} color="var(--good)" /> pago</>
                  : 'marcar pago'}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
