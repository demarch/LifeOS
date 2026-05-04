import { fmt } from '@/lib/fmt';
import type { Transaction } from '@/db/schema';

interface CategoryAllocationProps {
  transactions: Transaction[];
}

export function CategoryAllocation({ transactions }: CategoryAllocationProps) {
  const month = new Date().toISOString().slice(0, 7);
  const debits = transactions.filter(t => t.amount < 0 && t.date.startsWith(month));

  const catMap = new Map<string, number>();
  for (const t of debits) {
    const cat = t.category || 'Outros';
    catMap.set(cat, (catMap.get(cat) ?? 0) + Math.abs(t.amount));
  }

  const cats = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const total = cats.reduce((s, [, v]) => s + v, 0) || 1;

  const COLORS = [
    'var(--accent)', 'var(--good)', 'var(--info)', 'var(--warn)', 'var(--danger)',
  ];

  if (cats.length === 0) {
    return (
      <div className="card card-no-pad">
        <div className="card-head"><h2>Onde foi o dinheiro</h2></div>
        <div className="card-pad" style={{ color: 'var(--text-3)', fontSize: 13 }}>
          Sem gastos este mês ainda
        </div>
      </div>
    );
  }

  return (
    <div className="card card-no-pad">
      <div className="card-head">
        <h2>Onde foi o dinheiro</h2>
        <span className="sub">{new Date().toLocaleDateString('pt-BR', { month: 'long' })}</span>
      </div>
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cats.map(([name, v], i) => (
          <div key={name} className="prog">
            <div className="label">
              <span className="name">
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: COLORS[i], marginRight: 8 }} />
                {name}
              </span>
              <span className="v mask">{fmt(v)}</span>
            </div>
            <div className="track">
              <div className="fill" style={{ width: `${(v / total) * 100}%`, background: COLORS[i] }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
