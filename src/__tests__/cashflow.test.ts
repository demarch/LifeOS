import { describe, it, expect } from 'vitest';
import {
  recalcBalances,
  monthSummary,
  autoSeedPlan,
  planVsReal,
  nextMonthOpeningBalance,
} from '@/lib/cashflow';
import type { CashFlowMonth, CashFlowEntry, Subscription, Bill, Transaction } from '@/db/schema';

const mkMonth = (over: Partial<CashFlowMonth> = {}): CashFlowMonth => ({
  id: 'm1',
  key: '2026-05',
  name: 'maio 2026',
  openingBalance: 0,
  inheritOpening: 1,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

let entryCounter = 0;
const mkEntry = (over: Partial<CashFlowEntry> = {}): CashFlowEntry => ({
  id: `e${++entryCounter}`,
  monthId: 'm1',
  day: 1,
  date: '2026-05-01',
  description: '',
  note: null,
  entrada: 0,
  saida: 0,
  source: 'manual',
  sourceRefId: null,
  categoryId: null,
  createdAt: 0,
  ...over,
});

const mkSub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 's1',
  name: 'Netflix',
  amount: 50,
  billingDay: 15,
  category: 'Streaming',
  source: 'manual',
  alertDays: 3,
  isActive: 1,
  createdAt: 0,
  ...over,
});

const mkBill = (over: Partial<Bill> = {}): Bill => ({
  id: 'b1',
  name: 'Aluguel',
  amount: 1500,
  dueDay: 5,
  category: 'Casa',
  source: 'manual',
  isPaid: 0,
  paidAt: null,
  needsReview: 0,
  createdAt: 0,
  ...over,
});

const mkTx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  pluggyId: null,
  accountId: 'a1',
  description: '',
  amount: 0,
  type: 'debit',
  category: '',
  date: '2026-05-01',
  createdAt: 0,
  ...over,
});

describe('recalcBalances', () => {
  it('starts running balance from openingBalance', () => {
    const m = mkMonth({ openingBalance: 100 });
    const e = [mkEntry({ day: 1, entrada: 50 })];
    expect(recalcBalances(m, e)[0].saldo).toBe(150);
  });

  it('computes diario as entrada - saida per row', () => {
    const e = [mkEntry({ entrada: 70, saida: 20 })];
    expect(recalcBalances(mkMonth(), e)[0].diario).toBe(50);
  });

  it('sorts entries by day before folding balance', () => {
    const e = [
      mkEntry({ day: 3, entrada: 10 }),
      mkEntry({ day: 1, entrada: 100 }),
      mkEntry({ day: 2, saida: 30 }),
    ];
    const out = recalcBalances(mkMonth(), e);
    expect(out.map(r => r.day)).toEqual([1, 2, 3]);
    expect(out.map(r => r.saldo)).toEqual([100, 70, 80]);
  });

  it('does not mutate input array', () => {
    const e = [mkEntry({ day: 2 }), mkEntry({ day: 1 })];
    const snapshot = e.map(x => x.day);
    recalcBalances(mkMonth(), e);
    expect(e.map(x => x.day)).toEqual(snapshot);
  });

  it('returns empty array when there are no entries', () => {
    expect(recalcBalances(mkMonth(), [])).toEqual([]);
  });
});

describe('monthSummary', () => {
  it('totals entradas and saidas', () => {
    const e = [
      mkEntry({ entrada: 100 }),
      mkEntry({ saida: 30 }),
      mkEntry({ entrada: 20 }),
    ];
    const s = monthSummary(mkMonth(), e);
    expect(s.entradas).toBe(120);
    expect(s.saidas).toBe(30);
    expect(s.saldo).toBe(90);
  });

  it('pctInvestir is 10% of positive saldo', () => {
    const e = [mkEntry({ entrada: 1000 }), mkEntry({ saida: 100 })];
    expect(monthSummary(mkMonth(), e).pctInvestir).toBeCloseTo(90, 5);
  });

  it('pctInvestir is 0 when saldo <= 0', () => {
    const e = [mkEntry({ saida: 100 })];
    expect(monthSummary(mkMonth(), e).pctInvestir).toBe(0);
  });

  it('saidaTotal = saidas + pctInvestir', () => {
    const e = [mkEntry({ entrada: 1000 }), mkEntry({ saida: 100 })];
    const s = monthSummary(mkMonth(), e);
    expect(s.saidaTotal).toBeCloseTo(190, 5);
  });

  it('closingBalance = openingBalance + saldo', () => {
    const m = mkMonth({ openingBalance: 500 });
    const e = [mkEntry({ entrada: 100 })];
    expect(monthSummary(m, e).closingBalance).toBe(600);
  });

  it('performance equals saldo (mockup parity)', () => {
    const e = [mkEntry({ entrada: 200 }), mkEntry({ saida: 50 })];
    const s = monthSummary(mkMonth(), e);
    expect(s.performance).toBe(s.saldo);
  });
});

describe('autoSeedPlan', () => {
  it('emits one saida row per active subscription on its billingDay', () => {
    const rows = autoSeedPlan('2026-05', { subscriptions: [mkSub()], bills: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      day: 15,
      date: '2026-05-15',
      entrada: 0,
      saida: 50,
      source: 'subscription',
      sourceRefId: 's1',
      description: 'Netflix',
    });
  });

  it('emits one saida row per unpaid bill on its dueDay', () => {
    const rows = autoSeedPlan('2026-05', { subscriptions: [], bills: [mkBill()] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      day: 5,
      date: '2026-05-05',
      saida: 1500,
      source: 'bill',
      sourceRefId: 'b1',
    });
  });

  it('skips inactive subscriptions', () => {
    const rows = autoSeedPlan('2026-05', {
      subscriptions: [mkSub({ isActive: 0 })],
      bills: [],
    });
    expect(rows).toHaveLength(0);
  });

  it('skips paid bills', () => {
    const rows = autoSeedPlan('2026-05', {
      subscriptions: [],
      bills: [mkBill({ isPaid: 1 })],
    });
    expect(rows).toHaveLength(0);
  });

  it('skips bills with null amount', () => {
    const rows = autoSeedPlan('2026-05', {
      subscriptions: [],
      bills: [mkBill({ amount: null })],
    });
    expect(rows).toHaveLength(0);
  });

  it('zero-pads single-digit day in ISO date', () => {
    const rows = autoSeedPlan('2026-05', {
      subscriptions: [mkSub({ billingDay: 3 })],
      bills: [],
    });
    expect(rows[0].date).toBe('2026-05-03');
  });

  it('combines subs and bills in a single output', () => {
    const rows = autoSeedPlan('2026-05', {
      subscriptions: [mkSub()],
      bills: [mkBill()],
    });
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.source).sort()).toEqual(['bill', 'subscription']);
  });
});

describe('planVsReal', () => {
  it('matches real saidas to planned date and sign-flips negative amount', () => {
    const planned = recalcBalances(mkMonth(), [mkEntry({ date: '2026-05-15', saida: 50 })]);
    const real    = [mkTx({ date: '2026-05-15', amount: -45 })];
    const row = planVsReal(planned, real).find(r => r.date === '2026-05-15')!;
    expect(row.planned).toBe(50);
    expect(row.real).toBe(45);
    expect(row.delta).toBe(5);
  });

  it('excludes transfers from real-side sum', () => {
    const planned = recalcBalances(mkMonth(), [mkEntry({ date: '2026-05-15', saida: 0 })]);
    const real    = [mkTx({ date: '2026-05-15', amount: -100, type: 'transfer' })];
    expect(planVsReal(planned, real)[0].real).toBe(0);
  });

  it('sums multiple real txs on the same date', () => {
    const planned = recalcBalances(mkMonth(), [mkEntry({ date: '2026-05-15', saida: 100 })]);
    const real    = [
      mkTx({ date: '2026-05-15', amount: -40 }),
      mkTx({ id: 't2', date: '2026-05-15', amount: -10 }),
    ];
    expect(planVsReal(planned, real)[0].real).toBe(50);
  });

  it('ignores positive (credit) amounts on real side', () => {
    const planned = recalcBalances(mkMonth(), [mkEntry({ date: '2026-05-15', saida: 0 })]);
    const real    = [mkTx({ date: '2026-05-15', amount: 999 })];
    expect(planVsReal(planned, real)[0].real).toBe(0);
  });

  it('delta is planned - real (positive when underspent)', () => {
    const planned = recalcBalances(mkMonth(), [mkEntry({ date: '2026-05-15', saida: 100 })]);
    const real    = [mkTx({ date: '2026-05-15', amount: -30 })];
    expect(planVsReal(planned, real)[0].delta).toBe(70);
  });
});

describe('nextMonthOpeningBalance', () => {
  it('returns closingBalance of the given month', () => {
    const m = mkMonth({ openingBalance: 200 });
    const e = [mkEntry({ entrada: 50 })];
    expect(nextMonthOpeningBalance(m, e)).toBe(250);
  });

  it('returns openingBalance when month has no entries', () => {
    expect(nextMonthOpeningBalance(mkMonth({ openingBalance: 999 }), [])).toBe(999);
  });
});
