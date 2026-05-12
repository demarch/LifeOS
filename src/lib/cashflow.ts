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

export function recalcBalances(_m: CashFlowMonth, _entries: CashFlowEntry[]): ComputedEntry[] {
  throw new Error('NOT IMPLEMENTED');
}

export function monthSummary(_m: CashFlowMonth, _entries: CashFlowEntry[]): MonthSummary {
  throw new Error('NOT IMPLEMENTED');
}

export function autoSeedPlan(_monthKey: string, _src: SeedSource): SeedRow[] {
  throw new Error('NOT IMPLEMENTED');
}

export function planVsReal(_entries: ComputedEntry[], _real: Transaction[]): PlanVsRealRow[] {
  throw new Error('NOT IMPLEMENTED');
}

export function nextMonthOpeningBalance(_m: CashFlowMonth, _entries: CashFlowEntry[]): number {
  throw new Error('NOT IMPLEMENTED');
}
