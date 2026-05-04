import { fmt } from '@/lib/fmt';
import type { Account } from '@/db/schema';

interface AccountChipsProps {
  accounts: Account[];
}

export function AccountChips({ accounts }: AccountChipsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
      {accounts.map(a => (
        <div key={a.id} className="acct-chip">
          <div className="dot" style={{ background: a.color }}>{a.bank[0]}</div>
          <div className="meta">
            <div className="name">{a.bank} · {a.name}</div>
            <div className="info">
              {a.last4 ? `•••• ${a.last4}` : '—'} · {a.type === 'credit' ? 'crédito' : 'corrente'}
            </div>
          </div>
          <div
            className="balance mask"
            style={{ color: a.balance < 0 ? 'var(--danger)' : 'var(--text-0)' }}
          >
            {fmt(a.balance)}
          </div>
        </div>
      ))}
      {accounts.length === 0 && (
        <div style={{ gridColumn: '1/-1', color: 'var(--text-3)', padding: 12, fontSize: 13 }}>
          Nenhuma conta conectada — clique em Sincronizar para importar.
        </div>
      )}
    </div>
  );
}
