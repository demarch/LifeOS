'use client';
import { useState } from 'react';
import { Icon } from '@/components/atoms/icon';
import { Tag } from '@/components/atoms/tag';
import { fmt } from '@/lib/fmt';
import { dayLabel } from '@/lib/dates';
import type { Account, Transaction } from '@/db/schema';

interface TransactionsTableProps {
  transactions: Transaction[];
  accounts: Account[];
}

export function TransactionsTable({ transactions, accounts }: TransactionsTableProps) {
  const [catFilter, setCatFilter] = useState('all');
  const [acctFilter, setAcctFilter] = useState('all');

  const categories = ['all', ...Array.from(new Set(transactions.map(t => t.category).filter(Boolean)))];

  const filtered = transactions.filter(t =>
    (catFilter === 'all' || t.category === catFilter) &&
    (acctFilter === 'all' || t.accountId === acctFilter)
  );

  return (
    <div className="card card-no-pad">
      <div className="card-head">
        <h2>Transações</h2>
        <span className="sub">{filtered.length} resultados</span>
        <div className="right">
          <select
            value={acctFilter}
            onChange={e => setAcctFilter(e.target.value)}
            className="btn"
            style={{ paddingRight: 28 }}
          >
            <option value="all">Todas as contas</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.bank} · {a.name}</option>
            ))}
          </select>
          <button className="btn ghost"><Icon name="filter" size={14} /></button>
        </div>
      </div>

      <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="chips">
          {categories.map(c => (
            <span
              key={c}
              className={`chip${catFilter === c ? ' on' : ''}`}
              onClick={() => setCatFilter(c)}
            >
              {c === 'all' ? 'Todas categorias' : c}
            </span>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card-pad" style={{ color: 'var(--text-3)', fontSize: 13 }}>
          Nenhuma transação encontrada.
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Conta</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const acct = accounts.find(a => a.id === t.accountId);
              return (
                <tr key={t.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                    {dayLabel(t.date)}
                  </td>
                  <td style={{ color: 'var(--text-0)' }}>{t.description}</td>
                  <td>
                    {t.type === 'transfer'
                      ? <Tag tone="info">transferência</Tag>
                      : <Tag>{t.category || '—'}</Tag>}
                  </td>
                  <td>
                    <span style={{ color: acct?.color }}>●</span>{' '}
                    <span style={{ color: 'var(--text-2)' }}>{acct?.bank ?? '—'}</span>
                  </td>
                  <td
                    className="num-cell mask"
                    style={{ color: t.type === 'transfer' ? 'var(--text-3)' : t.amount > 0 ? 'var(--good)' : 'var(--text-0)' }}
                  >
                    {fmt(t.amount, { signed: true })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
