import Link from 'next/link';
import type { CashFlowEntry } from '@/db/schema';

interface CashFlowForecastProps {
  entries: CashFlowEntry[];
}

const DOW = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtMoney = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CashFlowForecast({ entries }: CashFlowForecastProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const byDate: Record<string, { entrada: number; saida: number; items: string[] }> = {};
  for (const e of entries) {
    const slot = (byDate[e.date] ??= { entrada: 0, saida: 0, items: [] });
    slot.entrada += e.entrada;
    slot.saida += e.saida;
    if (e.description) slot.items.push(e.description);
  }

  return (
    <div className="forecast-strip">
      {days.map((d, i) => {
        const iso = isoOf(d);
        const slot = byDate[iso];
        const monthKey = iso.slice(0, 7);
        const tipLines = slot
          ? [
              slot.entrada > 0 ? `Entrada: ${fmtMoney(slot.entrada)}` : null,
              slot.saida > 0 ? `Saída: ${fmtMoney(slot.saida)}` : null,
              ...slot.items,
            ].filter(Boolean)
          : [];
        const title = tipLines.length > 0 ? tipLines.join('\n') : `${iso} — sem lançamento`;
        return (
          <Link
            key={i}
            href={`/fluxo?month=${monthKey}`}
            className={`forecast-cell${i === 0 ? ' today' : ''}`}
            title={title}
          >
            <span className="dow">{DOW[d.getDay()]}</span>
            <span className="dn">{d.getDate()}</span>
            <span className="pips">
              {slot && slot.entrada > 0 && <span className="pip pip-good" />}
              {slot && slot.saida > 0 && <span className="pip pip-bad" />}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
