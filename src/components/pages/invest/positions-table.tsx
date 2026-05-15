import type { Position } from '@/db/schema';

interface PositionsTableProps {
  positions: Position[];
  total: number;
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function classLabel(c: string): string {
  if (c === 'stock') return 'Ação';
  if (c === 'fii') return 'FII';
  return 'Renda Fixa';
}

export function PositionsTable({ positions, total }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>
        Nenhuma posição. Configure Pluggy e clique em Atualizar.
      </div>
    );
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: 'var(--text-2)' }}>
          <th style={{ padding: '8px 6px' }}>Ticker</th>
          <th style={{ padding: '8px 6px' }}>Classe</th>
          <th style={{ padding: '8px 6px', textAlign: 'right' }}>Qty</th>
          <th style={{ padding: '8px 6px', textAlign: 'right' }}>PM</th>
          <th style={{ padding: '8px 6px', textAlign: 'right' }}>Cotação</th>
          <th style={{ padding: '8px 6px', textAlign: 'right' }}>Valor</th>
          <th style={{ padding: '8px 6px', textAlign: 'right' }}>%</th>
          <th style={{ padding: '8px 6px' }}>Alerta</th>
        </tr>
      </thead>
      <tbody>
        {positions.map(p => {
          const pct = total === 0 ? 0 : (p.currentValue / total) * 100;
          const stale = p.assetClass !== 'fixed_income' && (p.lastQuoteAt == null || (Date.now() / 1000 - p.lastQuoteAt) > 7 * 86400);
          const missing = (p.assetClass === 'stock' || p.assetClass === 'fii') && p.lastQuoteAt == null;
          return (
            <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
              <td style={{ padding: '8px 6px' }}>{p.ticker}</td>
              <td style={{ padding: '8px 6px' }}>{classLabel(p.assetClass)}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right' }}>{p.quantity}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtBRL(p.avgPrice)}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right' }}>{p.lastQuote == null ? '—' : fmtBRL(p.lastQuote)}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtBRL(p.currentValue)}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right' }}>{pct.toFixed(1)}%</td>
              <td style={{ padding: '8px 6px', color: 'var(--danger)' }}>
                {missing ? '⚠ sem cotação' : stale ? '⚠ desatualizado' : ''}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
