import type { CashFlowEntry, CashFlowMonth, Subscription, Bill, Transaction } from '@/db/schema';

export interface ComputedEntry extends CashFlowEntry {
  diario: number;
  saldo: number;
}

export interface MonthSummary {
  entradas: number;
  saidas: number;
  saldo: number;
  pctInvestir: number;
  saidaTotal: number;
  performance: number;
  closingBalance: number;
}

export interface PlanVsRealRow {
  date: string;
  planned: number;
  real: number;
  delta: number;
}

export interface SeedSource {
  subscriptions: Pick<Subscription, 'id' | 'name' | 'amount' | 'billingDay' | 'isActive'>[];
  bills:         Pick<Bill,         'id' | 'name' | 'amount' | 'dueDay'     | 'isPaid'>[];
}

export type SeedRow = Omit<CashFlowEntry, 'id' | 'monthId' | 'createdAt'>;

export function recalcBalances(m: CashFlowMonth, entries: CashFlowEntry[]): ComputedEntry[] {
  const sorted = [...entries].sort((a, b) => a.day - b.day);
  let running = m.openingBalance;
  return sorted.map(e => {
    const diario = (e.entrada ?? 0) - (e.saida ?? 0);
    running += diario;
    return { ...e, diario, saldo: running };
  });
}

export function monthSummary(m: CashFlowMonth, entries: CashFlowEntry[]): MonthSummary {
  const entradas = entries.reduce((s, e) => s + (e.entrada ?? 0), 0);
  const saidas   = entries.reduce((s, e) => s + (e.saida   ?? 0), 0);
  const saldo    = entradas - saidas;
  const pctInvestir = saldo > 0 ? saldo * 0.1 : 0;
  return {
    entradas,
    saidas,
    saldo,
    pctInvestir,
    saidaTotal: saidas + pctInvestir,
    performance: saldo,
    closingBalance: m.openingBalance + saldo,
  };
}

export function autoSeedPlan(monthKey: string, src: SeedSource): SeedRow[] {
  const rows: SeedRow[] = [];
  const pad = (n: number) => String(n).padStart(2, '0');

  for (const s of src.subscriptions) {
    if (!s.isActive) continue;
    rows.push({
      day: s.billingDay,
      date: `${monthKey}-${pad(s.billingDay)}`,
      description: s.name,
      note: null,
      entrada: 0,
      saida: s.amount,
      source: 'subscription',
      sourceRefId: s.id,
    });
  }

  for (const b of src.bills) {
    if (b.isPaid) continue;
    if (b.amount == null) continue;
    rows.push({
      day: b.dueDay,
      date: `${monthKey}-${pad(b.dueDay)}`,
      description: b.name,
      note: null,
      entrada: 0,
      saida: b.amount,
      source: 'bill',
      sourceRefId: b.id,
    });
  }

  return rows;
}

export function planVsReal(entries: ComputedEntry[], real: Transaction[]): PlanVsRealRow[] {
  const plannedByDate = new Map<string, number>();
  for (const e of entries) {
    plannedByDate.set(e.date, (plannedByDate.get(e.date) ?? 0) + (e.saida ?? 0));
  }

  const realByDate = new Map<string, number>();
  for (const t of real) {
    if (t.type === 'transfer') continue;
    if (t.amount >= 0) continue;
    realByDate.set(t.date, (realByDate.get(t.date) ?? 0) + Math.abs(t.amount));
  }

  const dates: Record<string, true> = {};
  plannedByDate.forEach((_, k) => { dates[k] = true; });
  realByDate.forEach((_, k) => { dates[k] = true; });
  const rows: PlanVsRealRow[] = Object.keys(dates).map(date => {
    const planned = plannedByDate.get(date) ?? 0;
    const realV   = realByDate.get(date) ?? 0;
    return { date, planned, real: realV, delta: planned - realV };
  });
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function nextMonthOpeningBalance(m: CashFlowMonth, entries: CashFlowEntry[]): number {
  return monthSummary(m, entries).closingBalance;
}
