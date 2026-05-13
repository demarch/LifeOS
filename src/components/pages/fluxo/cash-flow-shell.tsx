'use client';
import { useMemo, useState, useTransition } from 'react';
import { Icon } from '@/components/atoms/icon';
import { showToast } from '@/lib/toast';
import {
  recalcBalances,
  monthSummary,
  planVsReal as computePlanVsReal,
  type ComputedEntry,
} from '@/lib/cashflow';
import type { CashFlowMonth, CashFlowEntry, Transaction } from '@/db/schema';
import { GlobalKpis } from './global-kpis';
import { MonthTabs } from './month-tabs';
import { MonthSummaryStrip } from './month-summary';
import { EntriesTable } from './entries-table';
import { EvolutionChart } from './evolution-chart';
import { ComparisonChart } from './comparison-chart';
import { AddMonthDialog } from './add-month-dialog';

interface CashFlowShellProps {
  initialMonths: CashFlowMonth[];
  initialEntries: CashFlowEntry[];
  realTransactions: Transaction[];
  initialMonthId?: string | null;
}

export function CashFlowShell({ initialMonths, initialEntries, realTransactions, initialMonthId }: CashFlowShellProps) {
  const [months, setMonths]   = useState<CashFlowMonth[]>(initialMonths);
  const [entries, setEntries] = useState<CashFlowEntry[]>(initialEntries);
  const [currentId, setCurrentId] = useState<string | null>(initialMonthId ?? initialMonths[0]?.id ?? null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  const entriesByMonth = useMemo(() => {
    const m: Record<string, CashFlowEntry[]> = {};
    for (const e of entries) (m[e.monthId] ??= []).push(e);
    return m;
  }, [entries]);

  const entryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const id of Object.keys(entriesByMonth)) c[id] = entriesByMonth[id].length;
    return c;
  }, [entriesByMonth]);

  const currentMonth = months.find(m => m.id === currentId) ?? null;
  const currentEntries = currentMonth ? entriesByMonth[currentMonth.id] ?? [] : [];

  const computed: ComputedEntry[] = useMemo(
    () => (currentMonth ? recalcBalances(currentMonth, currentEntries) : []),
    [currentMonth, currentEntries],
  );

  const summary = useMemo(
    () => (currentMonth ? monthSummary(currentMonth, currentEntries) : null),
    [currentMonth, currentEntries],
  );

  const currentRealTx = useMemo(
    () => (currentMonth ? realTransactions.filter(t => t.date.startsWith(currentMonth.key)) : []),
    [currentMonth, realTransactions],
  );

  const planVsRealRows = useMemo(
    () => computePlanVsReal(computed, currentRealTx),
    [computed, currentRealTx],
  );

  const globalAgg = useMemo(() => {
    let entradas = 0;
    let saidas   = 0;
    let perfTotal = 0;
    for (const m of months) {
      const s = monthSummary(m, entriesByMonth[m.id] ?? []);
      entradas  += s.entradas;
      saidas    += s.saidas;
      perfTotal += s.performance;
    }
    return {
      entradas,
      saidas,
      saldo: entradas - saidas,
      mediaMensal: months.length > 0 ? perfTotal / months.length : 0,
    };
  }, [months, entriesByMonth]);

  const chartData = useMemo(() => {
    const sorted = [...months].sort((a, b) => a.key.localeCompare(b.key));
    return {
      labels: sorted.map(m => m.name),
      saldo:    sorted.map(m => monthSummary(m, entriesByMonth[m.id] ?? []).closingBalance),
      entradas: sorted.map(m => monthSummary(m, entriesByMonth[m.id] ?? []).entradas),
      saidas:   sorted.map(m => monthSummary(m, entriesByMonth[m.id] ?? []).saidas),
    };
  }, [months, entriesByMonth]);

  const refreshFromServer = async () => {
    const [mRes, eRes] = await Promise.all([
      fetch('/api/cashflow/months'),
      fetch('/api/cashflow/entries-all').catch(() => null),
    ]);
    if (mRes.ok) setMonths(await mRes.json());
    // entries: there is no list endpoint by design; just keep what we have
    // (mutations update local state directly)
    void eRes;
  };

  const addMonth = async (args: { key: string; openingBalance: number; inheritOpening: number; autoSeed: boolean }) => {
    const res = await fetch('/api/cashflow/months', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: args.key,
        openingBalance: args.inheritOpening ? undefined : args.openingBalance,
        inheritOpening: args.inheritOpening,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(body.error ?? 'Falha ao criar mês', 'error');
      return;
    }
    const created: CashFlowMonth = await res.json();
    setMonths(prev => [created, ...prev].sort((a, b) => b.key.localeCompare(a.key)));
    setCurrentId(created.id);
    setDialogOpen(false);
    showToast('Mês criado', 'success');

    if (args.autoSeed) {
      const seedRes = await fetch(`/api/cashflow/months/${created.id}/seed`, { method: 'POST' });
      if (seedRes.ok) {
        const { inserted } = await seedRes.json();
        if (Array.isArray(inserted) && inserted.length > 0) {
          setEntries(prev => [...prev, ...inserted]);
          showToast(`${inserted.length} lançamento(s) auto-populado(s)`, 'success');
        } else {
          showToast('Nada novo para popular', 'info');
        }
      }
    }
  };

  const seedCurrent = async () => {
    if (!currentMonth) return;
    const res = await fetch(`/api/cashflow/months/${currentMonth.id}/seed`, { method: 'POST' });
    if (!res.ok) {
      showToast('Falha ao popular', 'error');
      return;
    }
    const { inserted } = await res.json();
    if (Array.isArray(inserted) && inserted.length > 0) {
      setEntries(prev => [...prev, ...inserted]);
      showToast(`${inserted.length} lançamento(s) populado(s)`, 'success');
    } else {
      showToast('Nada novo para popular', 'info');
    }
  };

  const deleteMonth = async () => {
    if (!currentMonth) return;
    if (!confirm(`Excluir ${currentMonth.name} e todos seus lançamentos?`)) return;
    const res = await fetch(`/api/cashflow/months/${currentMonth.id}`, { method: 'DELETE' });
    if (!res.ok) { showToast('Falha ao excluir', 'error'); return; }
    const removed = currentMonth.id;
    setEntries(prev => prev.filter(e => e.monthId !== removed));
    setMonths(prev => {
      const next = prev.filter(m => m.id !== removed);
      setCurrentId(next[0]?.id ?? null);
      return next;
    });
    showToast('Mês excluído', 'success');
  };

  const addEntry = async () => {
    if (!currentMonth) return;
    const lastDay = currentEntries.reduce((max, e) => Math.max(max, e.day), 0);
    const nextDay = Math.min(31, lastDay + 1) || 1;
    const res = await fetch(`/api/cashflow/months/${currentMonth.id}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day: nextDay }),
    });
    if (!res.ok) { showToast('Falha ao adicionar', 'error'); return; }
    const created: CashFlowEntry = await res.json();
    setEntries(prev => [...prev, created]);
  };

  const patchEntry = async (
    entryId: string,
    field: 'day' | 'description' | 'entrada' | 'saida',
    value: string | number,
  ) => {
    const before = entries.find(e => e.id === entryId);
    if (!before) return;
    const optimistic: CashFlowEntry = { ...before, [field]: value } as CashFlowEntry;
    if (field === 'day' && currentMonth) {
      optimistic.date = `${currentMonth.key}-${String(value).padStart(2, '0')}`;
    }
    startTransition(() => {
      setEntries(prev => prev.map(e => (e.id === entryId ? optimistic : e)));
    });
    const res = await fetch(`/api/cashflow/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      setEntries(prev => prev.map(e => (e.id === entryId ? before : e)));
      showToast('Falha ao salvar', 'error');
    } else {
      const updated = await res.json();
      setEntries(prev => prev.map(e => (e.id === entryId ? updated : e)));
    }
  };

  const deleteEntry = async (entryId: string) => {
    const before = entries.find(e => e.id === entryId);
    if (!before) return;
    setEntries(prev => prev.filter(e => e.id !== entryId));
    const res = await fetch(`/api/cashflow/entries/${entryId}`, { method: 'DELETE' });
    if (!res.ok) {
      setEntries(prev => [...prev, before]);
      showToast('Falha ao remover', 'error');
    }
  };

  if (months.length === 0) {
    return (
      <>
        <GlobalKpis entradas={0} saidas={0} saldo={0} mediaMensal={0} monthCount={0} />
        <div className="card" style={{ marginTop: 16, textAlign: 'center', padding: 40 }}>
          <Icon name="trending" size={28} color="var(--text-3)" />
          <h2 style={{ marginTop: 12, fontSize: 16 }}>Nenhum mês cadastrado</h2>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 6 }}>
            Crie um mês para planejar entradas e saídas. As assinaturas e contas a pagar do Pluggy podem ser auto-populadas.
          </p>
          <button className="btn primary" style={{ marginTop: 14 }} onClick={() => setDialogOpen(true)}>
            <Icon name="plus" size={14} color="#14112b" /> Adicionar mês
          </button>
        </div>
        {dialogOpen && <AddMonthDialog onConfirm={addMonth} onCancel={() => setDialogOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <GlobalKpis
        entradas={globalAgg.entradas}
        saidas={globalAgg.saidas}
        saldo={globalAgg.saldo}
        mediaMensal={globalAgg.mediaMensal}
        monthCount={months.length}
      />

      <div className="fluxo-charts">
        <div className="fluxo-chart-card">
          <h3>Evolução do saldo</h3>
          <div className="canvas-wrap"><EvolutionChart labels={chartData.labels} data={chartData.saldo} /></div>
        </div>
        <div className="fluxo-chart-card">
          <h3>Entradas vs Saídas</h3>
          <div className="canvas-wrap"><ComparisonChart labels={chartData.labels} entradas={chartData.entradas} saidas={chartData.saidas} /></div>
        </div>
      </div>

      <div className="card card-no-pad">
        <MonthTabs
          months={months}
          currentId={currentId}
          entryCounts={entryCounts}
          onSelect={setCurrentId}
          onAdd={() => setDialogOpen(true)}
        />

        {currentMonth && summary && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 14, margin: 0 }}>{currentMonth.name}</h2>
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{currentEntries.length} lançamento(s)</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button className="btn ghost" onClick={seedCurrent}><Icon name="bot" size={13} /> Auto-popular</button>
                <button className="btn ghost" onClick={addEntry}><Icon name="plus" size={13} /> Lançamento</button>
                <button className="btn ghost" onClick={deleteMonth} title="Excluir mês"><Icon name="trash" size={13} /></button>
              </div>
            </div>

            <EntriesTable
              entries={computed}
              planVsReal={planVsRealRows}
              onPatch={patchEntry}
              onDelete={deleteEntry}
              onAddRow={addEntry}
            />

            <div style={{ padding: '0 16px 16px' }}>
              <MonthSummaryStrip summary={summary} openingBalance={currentMonth.openingBalance} />
            </div>
          </>
        )}
      </div>

      {dialogOpen && <AddMonthDialog onConfirm={addMonth} onCancel={() => setDialogOpen(false)} />}
    </>
  );
}
