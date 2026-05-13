'use client';
import { useMemo, useRef } from 'react';
import { Icon } from '@/components/atoms/icon';
import { fmt } from '@/lib/fmt';
import type { ComputedEntry, PlanVsRealRow } from '@/lib/cashflow';

interface EntriesTableProps {
  entries: ComputedEntry[];
  planVsReal: PlanVsRealRow[];
  onPatch: (entryId: string, field: 'day' | 'description' | 'entrada' | 'saida', value: string | number) => void;
  onDelete: (entryId: string) => void;
  onAddRow: () => void;
}

const num = (v: unknown): string => {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '';
  const n = Number(v);
  return n === 0 ? '' : String(n);
};

export function EntriesTable({ entries, planVsReal, onPatch, onDelete, onAddRow }: EntriesTableProps) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  const realByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of planVsReal) m.set(r.date, r.real);
    return m;
  }, [planVsReal]);

  const moveFocus = (rowIdx: number, colKey: string, direction: 'right' | 'down') => {
    const tbody = tbodyRef.current;
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');

    if (direction === 'right') {
      const order = ['day', 'description', 'entrada', 'saida'];
      const i = order.indexOf(colKey);
      const next = order[i + 1];
      if (next) {
        const el = rows[rowIdx]?.querySelector<HTMLInputElement>(`input[data-col="${next}"]`);
        el?.focus();
      } else {
        moveFocus(rowIdx, 'day', 'down');
      }
    } else if (direction === 'down') {
      const next = rows[rowIdx + 1];
      if (next) {
        const el = next.querySelector<HTMLInputElement>(`input[data-col="${colKey}"]`);
        el?.focus();
      } else {
        onAddRow();
        // focus the new row's same column after the table re-renders
        setTimeout(() => {
          const after = tbodyRef.current?.querySelectorAll('tr');
          const target = after?.[rowIdx + 1]?.querySelector<HTMLInputElement>(`input[data-col="${colKey}"]`);
          target?.focus();
        }, 30);
      }
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, col: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      moveFocus(rowIdx, col, 'down');
    } else if (e.key === 'Tab' && !e.shiftKey) {
      // browser default Tab handles horizontal — no preventDefault needed
    }
  };

  return (
    <div style={{ overflowX: 'auto', borderTop: '1px solid var(--line)' }}>
      <table className="fluxo-tbl">
        <thead>
          <tr>
            <th className="col-day col-sticky">Dia</th>
            <th className="col-desc">Descrição</th>
            <th>Entrada</th>
            <th>Saída</th>
            <th>Diário</th>
            <th>Saldo</th>
            <th>Real (saída)</th>
            <th>Δ</th>
            <th className="col-actions"></th>
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
                Nenhum lançamento. Use “+ Lançamento” ou “Auto-popular”.
              </td>
            </tr>
          ) : (
            entries.map((e, idx) => {
              const realVal = realByDate.get(e.date) ?? 0;
              const delta = e.saida - realVal;
              const realTone = realVal > 0 ? 'negative' : 'neutral';
              const deltaTone = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
              return (
                <tr key={e.id}>
                  <td className="col-day col-sticky">
                    <input
                      type="number"
                      data-col="day"
                      min={1}
                      max={31}
                      defaultValue={e.day}
                      onBlur={ev => {
                        const v = parseInt(ev.target.value, 10);
                        if (!Number.isNaN(v) && v !== e.day) onPatch(e.id, 'day', v);
                      }}
                      onKeyDown={ev => handleKey(ev, idx, 'day')}
                    />
                  </td>
                  <td className="col-desc">
                    <input
                      type="text"
                      data-col="description"
                      defaultValue={e.description ?? ''}
                      placeholder={e.source === 'subscription' ? '(assinatura)' : e.source === 'bill' ? '(conta)' : '—'}
                      onBlur={ev => {
                        if (ev.target.value !== (e.description ?? '')) onPatch(e.id, 'description', ev.target.value);
                      }}
                      onKeyDown={ev => handleKey(ev, idx, 'description')}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      data-col="entrada"
                      step="0.01"
                      defaultValue={num(e.entrada)}
                      placeholder="0,00"
                      onBlur={ev => {
                        const v = parseFloat(ev.target.value) || 0;
                        if (v !== e.entrada) onPatch(e.id, 'entrada', v);
                      }}
                      onKeyDown={ev => handleKey(ev, idx, 'entrada')}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      data-col="saida"
                      step="0.01"
                      defaultValue={num(e.saida)}
                      placeholder="0,00"
                      onBlur={ev => {
                        const v = parseFloat(ev.target.value) || 0;
                        if (v !== e.saida) onPatch(e.id, 'saida', v);
                      }}
                      onKeyDown={ev => handleKey(ev, idx, 'saida')}
                    />
                  </td>
                  <td>
                    <span className={`cell-static mask cell-amt ${e.diario > 0 ? 'positive' : e.diario < 0 ? 'negative' : 'neutral'}`} style={{ textAlign: 'right', display: 'block' }}>
                      {fmt(e.diario)}
                    </span>
                  </td>
                  <td>
                    <span className={`cell-static mask cell-amt ${e.saldo >= 0 ? 'positive' : 'negative'}`} style={{ textAlign: 'right', display: 'block' }}>
                      {fmt(e.saldo)}
                    </span>
                  </td>
                  <td>
                    <span className={`cell-static mask cell-amt ${realTone}`} style={{ textAlign: 'right', display: 'block' }}>
                      {realVal > 0 ? fmt(realVal) : '—'}
                    </span>
                  </td>
                  <td>
                    <span className={`cell-static mask cell-amt ${deltaTone}`} style={{ textAlign: 'right', display: 'block' }}>
                      {realVal > 0 ? fmt(delta, { signed: true }) : '—'}
                    </span>
                  </td>
                  <td className="col-actions">
                    <button onClick={() => onDelete(e.id)} title="Remover">
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
