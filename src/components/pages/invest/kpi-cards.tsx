import type { ClassTotals } from '@/lib/invest/types';

interface KpiCardsProps {
  totals: ClassTotals;
  totalCost: number;
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(v: number, total: number): string {
  if (total === 0) return '0%';
  return ((v / total) * 100).toFixed(1) + '%';
}

function fmtGain(current: number, cost: number): { text: string; positive: boolean } {
  const diff = current - cost;
  const pct = cost === 0 ? 0 : (diff / cost) * 100;
  return {
    text: `${diff >= 0 ? '+' : ''}${fmtBRL(diff)} (${pct.toFixed(2)}%)`,
    positive: diff >= 0,
  };
}

export function KpiCards({ totals, totalCost }: KpiCardsProps) {
  const overall = fmtGain(totals.total, totalCost);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <Card title="Patrimônio" value={fmtBRL(totals.total)} sub={overall.text} good={overall.positive} />
      <Card title="Ações"      value={fmtBRL(totals.stocks)}      sub={fmtPct(totals.stocks, totals.total)} />
      <Card title="FIIs"       value={fmtBRL(totals.fiis)}        sub={fmtPct(totals.fiis, totals.total)} />
      <Card title="Renda Fixa" value={fmtBRL(totals.fixedIncome)} sub={fmtPct(totals.fixedIncome, totals.total)} />
    </div>
  );
}

interface CardProps { title: string; value: string; sub: string; good?: boolean }
function Card({ title, value, sub, good }: CardProps) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, marginTop: 6, color: good === undefined ? 'var(--text-2)' : good ? 'var(--good)' : 'var(--danger)' }}>{sub}</div>
    </div>
  );
}
