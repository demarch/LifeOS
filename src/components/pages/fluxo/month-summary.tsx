import { fmt } from '@/lib/fmt';
import type { MonthSummary } from '@/lib/cashflow';

interface MonthSummaryProps {
  summary: MonthSummary;
  openingBalance: number;
}

export function MonthSummaryStrip({ summary, openingBalance }: MonthSummaryProps) {
  return (
    <div className="fluxo-summary">
      <div className="item">
        <span className="lbl">Saldo inicial</span>
        <span className="val mask">{fmt(openingBalance)}</span>
      </div>
      <div className="item">
        <span className="lbl">Entradas</span>
        <span className="val positive mask">{fmt(summary.entradas)}</span>
      </div>
      <div className="item">
        <span className="lbl">Saídas</span>
        <span className="val negative mask">{fmt(summary.saidas)}</span>
      </div>
      <div className="item">
        <span className="lbl">Performance</span>
        <span className={`val mask ${summary.saldo >= 0 ? 'positive' : 'negative'}`}>{fmt(summary.performance)}</span>
      </div>
      <div className="item">
        <span className="lbl">% a investir (10%)</span>
        <span className="val warn mask">{fmt(summary.pctInvestir)}</span>
      </div>
      <div className="item">
        <span className="lbl">Saldo final</span>
        <span className={`val mask ${summary.closingBalance >= 0 ? 'positive' : 'negative'}`}>{fmt(summary.closingBalance)}</span>
      </div>
    </div>
  );
}
