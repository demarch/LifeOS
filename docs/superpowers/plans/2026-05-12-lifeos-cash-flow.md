# Life OS — Cash Flow (Fluxo de Caixa) Implementation Plan — TDD

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:tdd combined with superpowers:executing-plans. Every behavior change starts at a failing test. The plan is split into a **Test phase** (write the whole suite, watch it go red) and an **Implementation phase** (turn it green file-by-file). No production code is written before its test exists.

**Goal:** Promote the standalone mockup `sistema_fluxo_caixa.html` (multi-month cash-flow planner with daily entries, running balance, dashboards, and charts) into a first-class Life OS feature backed by SQLite, integrated with Pluggy-sourced `transactions`, `bills`, and `subscriptions` so the user gets **plan vs. real** comparisons and automatic seeding from real recurring spend.

**Mockup baseline (must preserve):**
- Tabs per month (`YYYY-MM`), table of daily entries (day, date, entrada, saída, diário, saldo corrido).
- Per-month summary: entradas, saídas, saldo, % to invest (10% of profit), saída total, performance.
- Global KPI strip: total entradas, total saídas, saldo, mensal mean.
- Two charts: balance evolution (line) and entradas vs saídas (bar).
- CRUD for months and entries.

**Upgrades over the mockup (the "next level"):**
1. **Persistence in SQLite** (not localStorage), already syncable through the existing `/api/sync` stub.
2. **Plan vs Real overlay**: each planned day is compared against the actual Pluggy-synced `transactions` for that date.
3. **Auto-seeding from real data**: when a month is created, planned entries are pre-filled from active `subscriptions` (billingDay → saída) and unpaid `bills` (dueDay → saída) — both of which originate from Pluggy via `lib/auto-detect.ts`.
4. **Description + note fields** on entries (mockup has none, required for real use).
5. **Sticky running-balance header** and **keyboard nav** (Tab/Enter) on the entries table.
6. **30-day forecast strip** on the Home page using next month's plan.

**Explicitly NOT in scope:** importing the mockup's JSON. The mockup was a throwaway prototype; real data already flows in through Pluggy/OpenFinance into `transactions`, `subscriptions`, and `bills`. The cash-flow feature is a **planning layer** on top of that pipeline.

**Architecture:** Next.js 14 App Router. Server Components fetch months/entries directly via Drizzle. A single Client Component (`cash-flow-shell.tsx`) owns the tabbed UI and mutates via `/api/cashflow/*` routes. Charts use Chart.js (mockup-parity) via `react-chartjs-2`. **Derived fields (`diario`, `saldo`) are never persisted** — always computed from `entrada - saida` sorted by day.

**Tech stack:** existing — Next.js 14, TypeScript, Drizzle ORM, better-sqlite3, Vitest. New deps: `chart.js`, `react-chartjs-2`. **For TDD on API routes:** add `vitest`'s built-in `fetch`-style helpers via Next's `Request`/`Response` globals; no extra runtime needed.

---

## File Map

```
lifeos/
├── package.json                                       # + chart.js, react-chartjs-2
├── src/
│   ├── app/
│   │   ├── fluxo/
│   │   │   └── page.tsx                               # Server Component
│   │   └── api/
│   │       └── cashflow/
│   │           ├── months/route.ts
│   │           ├── months/[id]/route.ts
│   │           ├── months/[id]/seed/route.ts
│   │           ├── months/[id]/entries/route.ts
│   │           └── entries/[id]/route.ts
│   ├── components/
│   │   ├── shell/sidebar.tsx                          # + nav '/fluxo'
│   │   ├── atoms/icon.tsx                             # + 'trending'
│   │   └── pages/fluxo/
│   │       ├── cash-flow-shell.tsx                    # 'use client' orchestrator
│   │       ├── month-tabs.tsx
│   │       ├── entries-table.tsx                      # inline edit + keyboard nav + plan×real
│   │       ├── month-summary.tsx
│   │       ├── global-kpis.tsx
│   │       ├── evolution-chart.tsx
│   │       ├── comparison-chart.tsx
│   │       └── add-month-dialog.tsx
│   ├── db/
│   │   └── schema.ts                                  # + cashFlowMonths, cashFlowEntries
│   └── lib/
│       └── cashflow.ts                                # pure: recalcBalances, monthSummary, autoSeedPlan, planVsReal, nextMonthOpeningBalance
├── src/__tests__/
│   ├── cashflow.test.ts                               # pure-function suite (Phase 1A)
│   └── cashflow-api.test.ts                           # route handler suite (Phase 1B)
└── docs/
    └── superpowers/
        └── plans/2026-05-12-lifeos-cash-flow.md       # this file
```

---

# Phase 0 — Schema only (no behavior, just types so tests compile)

## Task 0 — Append schema tables

**Files:**
- Edit: `src/db/schema.ts`

- [ ] **Step 1: Append cash-flow tables and type exports**

```typescript
export const cashFlowMonths = sqliteTable('cash_flow_months', {
  id:             text('id').primaryKey(),
  key:            text('key').notNull().unique(),       // 'YYYY-MM'
  name:           text('name').notNull(),               // 'maio 2026'
  openingBalance: real('opening_balance').notNull().default(0),
  inheritOpening: integer('inherit_opening').notNull().default(1),
  createdAt:      integer('created_at').notNull(),
  updatedAt:      integer('updated_at').notNull(),
});

export const cashFlowEntries = sqliteTable('cash_flow_entries', {
  id:          text('id').primaryKey(),
  monthId:     text('month_id').notNull().references(() => cashFlowMonths.id, { onDelete: 'cascade' }),
  day:         integer('day').notNull(),
  date:        text('date').notNull(),
  description: text('description').notNull().default(''),
  note:        text('note'),
  entrada:     real('entrada').notNull().default(0),
  saida:       real('saida').notNull().default(0),
  source:      text('source').notNull().default('manual'),   // manual | subscription | bill
  sourceRefId: text('source_ref_id'),
  createdAt:   integer('created_at').notNull(),
});

export type CashFlowMonth = typeof cashFlowMonths.$inferSelect;
export type CashFlowEntry = typeof cashFlowEntries.$inferSelect;
```

- [ ] **Step 2: Push migration**

```
npm run db:push
```

> Schema is foundational metadata, not behavior — it does not need a red test before existing. The first behavioral red test starts at Phase 1.

---

# Phase 1 — Write the entire failing test suite (RED)

> **Rules during this phase:** Do not write any production code in `src/lib/cashflow.ts`, in `src/app/api/cashflow/**`, or in any UI component. Only:
> - the test files listed below,
> - empty stub modules with the *signatures* the tests import (so TypeScript compiles), where each stub body throws `new Error('NOT IMPLEMENTED')`.
>
> After Phase 1 you must observe **every test failing** (either by assertion or by `NOT IMPLEMENTED`). If a test passes accidentally, it isn't testing anything — fix the test.

## Task 1A — Pure-function tests (`src/__tests__/cashflow.test.ts`)

**Files:**
- Create: `src/__tests__/cashflow.test.ts`
- Create: `src/lib/cashflow.ts` — **stub only** (exports throwing functions with the right signatures)

- [ ] **Step 1: Create the stub** with the surface area the tests need:

```typescript
// src/lib/cashflow.ts — STUB. Phase 2 will replace bodies.
import type { CashFlowEntry, CashFlowMonth, Subscription, Bill, Transaction } from '@/db/schema';

export interface ComputedEntry extends CashFlowEntry { diario: number; saldo: number; }
export interface MonthSummary {
  entradas: number; saidas: number; saldo: number;
  pctInvestir: number; saidaTotal: number; performance: number;
  closingBalance: number;
}
export interface PlanVsRealRow { date: string; planned: number; real: number; delta: number; }
export interface SeedSource {
  subscriptions: Pick<Subscription, 'id'|'name'|'amount'|'billingDay'|'isActive'>[];
  bills:         Pick<Bill,         'id'|'name'|'amount'|'dueDay'|'isPaid'>[];
}
export type SeedRow = Omit<CashFlowEntry, 'id'|'monthId'|'createdAt'>;

export function recalcBalances(_m: CashFlowMonth, _e: CashFlowEntry[]): ComputedEntry[] { throw new Error('NOT IMPLEMENTED'); }
export function monthSummary(_m: CashFlowMonth, _e: CashFlowEntry[]): MonthSummary       { throw new Error('NOT IMPLEMENTED'); }
export function autoSeedPlan(_key: string, _src: SeedSource): SeedRow[]                  { throw new Error('NOT IMPLEMENTED'); }
export function planVsReal(_e: ComputedEntry[], _t: Transaction[]): PlanVsRealRow[]      { throw new Error('NOT IMPLEMENTED'); }
export function nextMonthOpeningBalance(_m: CashFlowMonth, _e: CashFlowEntry[]): number  { throw new Error('NOT IMPLEMENTED'); }
```

- [ ] **Step 2: Write the test file**. Each `it` block must isolate one behavior. Sample fixtures live inline (no shared mutable state).

```typescript
// src/__tests__/cashflow.test.ts
import { describe, it, expect } from 'vitest';
import { recalcBalances, monthSummary, autoSeedPlan, planVsReal, nextMonthOpeningBalance } from '@/lib/cashflow';
import type { CashFlowMonth, CashFlowEntry, Subscription, Bill, Transaction } from '@/db/schema';

const mkMonth = (over: Partial<CashFlowMonth> = {}): CashFlowMonth => ({
  id: 'm1', key: '2026-05', name: 'maio 2026',
  openingBalance: 0, inheritOpening: 1,
  createdAt: 0, updatedAt: 0, ...over,
});
const mkEntry = (over: Partial<CashFlowEntry> = {}): CashFlowEntry => ({
  id: crypto.randomUUID(), monthId: 'm1',
  day: 1, date: '2026-05-01',
  description: '', note: null,
  entrada: 0, saida: 0,
  source: 'manual', sourceRefId: null,
  createdAt: 0, ...over,
});

describe('recalcBalances', () => {
  it('returns running balance starting from openingBalance', () => {
    const m = mkMonth({ openingBalance: 100 });
    const e = [mkEntry({ day: 1, entrada: 50, saida: 0 })];
    expect(recalcBalances(m, e)[0].saldo).toBe(150);
  });

  it('computes diario as entrada - saida per row', () => {
    const e = [mkEntry({ entrada: 70, saida: 20 })];
    expect(recalcBalances(mkMonth(), e)[0].diario).toBe(50);
  });

  it('sorts entries by day before computing balance', () => {
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

  it('returns empty array on no entries', () => {
    expect(recalcBalances(mkMonth(), [])).toEqual([]);
  });
});

describe('monthSummary', () => {
  it('totals entradas and saidas', () => {
    const e = [mkEntry({ entrada: 100 }), mkEntry({ saida: 30 }), mkEntry({ entrada: 20 })];
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
});

describe('autoSeedPlan', () => {
  const sub = (over: Partial<Subscription>): Subscription => ({
    id: 's1', name: 'Netflix', amount: 50,
    billingDay: 15, category: 'Streaming', source: 'manual',
    alertDays: 3, isActive: 1, createdAt: 0, ...over,
  });
  const bill = (over: Partial<Bill>): Bill => ({
    id: 'b1', name: 'Aluguel', amount: 1500,
    dueDay: 5, category: 'Casa', source: 'manual',
    isPaid: 0, paidAt: null, needsReview: 0, createdAt: 0, ...over,
  });

  it('emits one saida row per active subscription on its billingDay', () => {
    const rows = autoSeedPlan('2026-05', { subscriptions: [sub({})], bills: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ day: 15, date: '2026-05-15', saida: 50, source: 'subscription', sourceRefId: 's1' });
  });

  it('skips inactive subscriptions', () => {
    const rows = autoSeedPlan('2026-05', { subscriptions: [sub({ isActive: 0 })], bills: [] });
    expect(rows).toHaveLength(0);
  });

  it('skips paid bills', () => {
    const rows = autoSeedPlan('2026-05', { subscriptions: [], bills: [bill({ isPaid: 1 })] });
    expect(rows).toHaveLength(0);
  });

  it('skips bills with null amount', () => {
    const rows = autoSeedPlan('2026-05', { subscriptions: [], bills: [bill({ amount: null })] });
    expect(rows).toHaveLength(0);
  });

  it('zero-pads day in ISO date', () => {
    const rows = autoSeedPlan('2026-05', { subscriptions: [sub({ billingDay: 3 })], bills: [] });
    expect(rows[0].date).toBe('2026-05-03');
  });
});

describe('planVsReal', () => {
  const tx = (over: Partial<Transaction>): Transaction => ({
    id: 't1', pluggyId: null, accountId: 'a1',
    description: '', amount: 0, type: 'debit',
    category: '', date: '2026-05-01', createdAt: 0, ...over,
  });

  it('matches real saidas to planned date and sign-flips amount', () => {
    const planned = recalcBalances(mkMonth(), [mkEntry({ date: '2026-05-15', saida: 50 })]);
    const real    = [tx({ date: '2026-05-15', amount: -45, type: 'debit' })];
    const rows = planVsReal(planned, real);
    const row = rows.find(r => r.date === '2026-05-15')!;
    expect(row.planned).toBe(50);
    expect(row.real).toBe(45);
    expect(row.delta).toBe(5);
  });

  it('excludes transfers from real-side sum', () => {
    const planned = recalcBalances(mkMonth(), [mkEntry({ date: '2026-05-15', saida: 0 })]);
    const real    = [tx({ date: '2026-05-15', amount: -100, type: 'transfer' })];
    expect(planVsReal(planned, real)[0].real).toBe(0);
  });

  it('sums multiple real txs on the same date', () => {
    const planned = recalcBalances(mkMonth(), [mkEntry({ date: '2026-05-15', saida: 100 })]);
    const real    = [tx({ date: '2026-05-15', amount: -40 }), tx({ id: 't2', date: '2026-05-15', amount: -10 })];
    expect(planVsReal(planned, real)[0].real).toBe(50);
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
```

## Task 1B — API route tests (`src/__tests__/cashflow-api.test.ts`)

**Files:**
- Create: `src/__tests__/cashflow-api.test.ts`
- Create stubs (throwing) for each route handler so imports resolve:
  - `src/app/api/cashflow/months/route.ts`
  - `src/app/api/cashflow/months/[id]/route.ts`
  - `src/app/api/cashflow/months/[id]/seed/route.ts`
  - `src/app/api/cashflow/months/[id]/entries/route.ts`
  - `src/app/api/cashflow/entries/[id]/route.ts`

Each stub exports the verbs (`GET`/`POST`/`PATCH`/`DELETE`) it needs as `async () => { throw new Error('NOT IMPLEMENTED'); }`.

- [ ] **Step 1: Provide an in-memory DB for tests.**

```typescript
// src/__tests__/cashflow-api.test.ts (top)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@/db/schema';

let testDb: ReturnType<typeof drizzle>;
beforeEach(() => {
  const sqlite = new Database(':memory:');
  testDb = drizzle(sqlite, { schema });
  // run pragma + create tables from schema.sql snapshot — generated via drizzle-kit push --dry once,
  // committed to src/__tests__/fixtures/schema.sql for hermeticism.
  sqlite.exec(require('fs').readFileSync(`${__dirname}/fixtures/schema.sql`, 'utf8'));
  vi.doMock('@/db/client', () => ({ db: testDb }));
});
```

> Implementation note: capture the current `lifeos.db` schema once with `sqlite3 lifeos.db .schema > src/__tests__/fixtures/schema.sql` after Task 0 and commit. This keeps API tests pure (no shared FS state, no Pluggy).

- [ ] **Step 2: Months collection tests**

```typescript
describe('POST /api/cashflow/months', () => {
  it('creates a month with explicit openingBalance', async () => {
    const { POST } = await import('@/app/api/cashflow/months/route');
    const res = await POST(new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ key: '2026-05', openingBalance: 1000, inheritOpening: 0 }),
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ key: '2026-05', openingBalance: 1000 });
  });

  it('rejects duplicate key with 409', async () => {
    const { POST } = await import('@/app/api/cashflow/months/route');
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ key: '2026-05' }) }));
    const dup = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ key: '2026-05' }) }));
    expect(dup.status).toBe(409);
  });

  it('inherits openingBalance from previous month closingBalance when inheritOpening=1 and previous exists', async () => {
    const { POST } = await import('@/app/api/cashflow/months/route');
    // seed prev: opening 100 + entry entrada 50 -> closing 150
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ key: '2026-04', openingBalance: 100 }) }));
    // insert entry on 2026-04 directly through testDb...
    // create May with inheritOpening
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ key: '2026-05', inheritOpening: 1 }) }));
    const body = await res.json();
    expect(body.openingBalance).toBe(150);
  });

  it('GET returns all months ordered by key desc', async () => {
    const { GET, POST } = await import('@/app/api/cashflow/months/route');
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ key: '2026-04' }) }));
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ key: '2026-05' }) }));
    const res = await GET(new Request('http://x'));
    expect((await res.json()).map((m: any) => m.key)).toEqual(['2026-05', '2026-04']);
  });
});
```

- [ ] **Step 3: Single-month tests** (`months/[id]`): PATCH rename, PATCH openingBalance, DELETE cascades entries.

```typescript
describe('PATCH /api/cashflow/months/[id]', () => {
  it('updates name and openingBalance', async () => { /* ... */ });
});

describe('DELETE /api/cashflow/months/[id]', () => {
  it('removes the month and its entries (cascade)', async () => { /* ... */ });
  it('returns 404 when id unknown', async () => { /* ... */ });
});
```

- [ ] **Step 4: Seed endpoint tests** (`months/[id]/seed`):
  - Seeds a saida row per active subscription on its `billingDay`.
  - Skips inactive subs and paid bills.
  - **Idempotent**: calling seed twice does not duplicate rows (matched on `source` + `sourceRefId`).
  - Returns the created entries.

- [ ] **Step 5: Entries endpoint tests**:
  - `POST months/[id]/entries`: rejects unknown month with 404; computes `date` from `month.key` and `day`; defaults `source` to `'manual'`.
  - `PATCH entries/[id]`: partial update (entrada only); updates `updatedAt` on parent month.
  - `DELETE entries/[id]`: removes entry; touches parent month's `updatedAt`.

- [ ] **Step 6: Run `npm run test:run`. Every test should fail or throw `NOT IMPLEMENTED`. Commit at this checkpoint:**

```
git add -A && git commit -m "test(cashflow): red — failing suite for pure fns + API routes"
```

---

# Phase 2 — Make pure-function tests green (GREEN)

## Task 2 — Implement `src/lib/cashflow.ts`

**Files:**
- Edit: `src/lib/cashflow.ts` (replace stubs)

Implement in this order, running `npm run test src/__tests__/cashflow.test.ts` after each function:

- [ ] **Step 1:** `recalcBalances` — sort by `day`, fold `(entrada - saida)` starting from `openingBalance`.
- [ ] **Step 2:** `monthSummary` — reduce; clamp `pctInvestir` to non-negative saldo.
- [ ] **Step 3:** `autoSeedPlan` — filter active subs + unpaid bills with amount, emit `SeedRow`s.
- [ ] **Step 4:** `planVsReal` — group `planned` by `date`, sum real `Math.abs(amount)` where `amount < 0 && type !== 'transfer'`.
- [ ] **Step 5:** `nextMonthOpeningBalance` — delegate to `monthSummary(m, e).closingBalance`.

**Exit condition:** `cashflow.test.ts` is 100% green. Commit:

```
git commit -m "feat(cashflow): pure domain functions (green)"
```

---

# Phase 3 — Make API tests green (GREEN)

## Task 3 — Implement route handlers

> Mirror the style of `src/app/api/transactions/route.ts`: import `db` from `@/db/client`, use Drizzle, return `NextResponse.json`. No zod yet — manually validate.

- [ ] **Step 1: `months/route.ts`** — GET (list desc by `key`), POST (create with optional inherit lookup).
- [ ] **Step 2: `months/[id]/route.ts`** — PATCH (name/openingBalance), DELETE (cascade via FK).
- [ ] **Step 3: `months/[id]/seed/route.ts`** — read subs+bills, call `autoSeedPlan`, insert with `INSERT OR IGNORE` keyed on `(monthId, source, sourceRefId)`. **Add a unique index** on those three columns in schema before implementing (back to Task 0, run a fresh `db:push`); add a red test if you don't already have one for the idempotency case.
- [ ] **Step 4: `months/[id]/entries/route.ts`** — POST.
- [ ] **Step 5: `entries/[id]/route.ts`** — PATCH/DELETE.

**Exit condition:** `cashflow-api.test.ts` is 100% green. Commit:

```
git commit -m "feat(cashflow): API routes (green)"
```

---

# Phase 4 — UI (covered by manual QA scenarios, not unit tests)

> Rationale: Vitest is configured for `node` env, no jsdom or RTL installed. Adding a UI testing stack triples scope without proportional safety gain for a single-page feature whose logic already lives in tested pure functions and tested API routes. **Each UI task below lists the manual QA scenario that proves it.** If the user later requests automated UI tests, switch `vitest.config.ts` to `jsdom`, add `@testing-library/react`, and add the listed scenarios as `it` blocks.

## Task 4 — Sidebar + icon

- [ ] Add `trending` icon glyph to `src/components/atoms/icon.tsx` (24×24 line up-right).
- [ ] Insert `{ href: '/fluxo', label: 'Fluxo', icon: 'trending' }` in `src/components/shell/sidebar.tsx` between `/financas` and `/contas`.

**QA:** Sidebar shows the new entry; clicking navigates; active state lights up.

## Task 5 — Server page `src/app/fluxo/page.tsx`

- [ ] Load `cashFlowMonths` desc, all `cashFlowEntries` (filtered by `inArray` of those month IDs), and `transactions` whose `date` starts with any of the visible month keys.
- [ ] Render `<CashFlowShell initialMonths initialEntries realTransactions />`.

**QA:** With an empty DB, the page renders an empty-state and an "Adicionar mês" button.

## Task 6 — Client shell + sub-components

Order: leaf → composite. Each leaf renders only from props; `cash-flow-shell.tsx` holds all state.

- [ ] **`global-kpis.tsx`** — 4 KPI tiles using `.kpi` styles. QA: totals match across all months.
- [ ] **`month-tabs.tsx`** — horizontal scroll tabs. QA: keyboard arrow keys cycle tabs (focus management).
- [ ] **`month-summary.tsx`** — 6 summary tiles. QA: numbers update live on entry edit.
- [ ] **`entries-table.tsx`** — table with columns `Dia | Data | Descrição | Entrada | Saída | Diário | Saldo | Real | Δ | Ações`. Inline-edit cells call back to shell; Tab/Enter keyboard nav; first column sticky. QA scenarios:
  1. Edit entrada in row 3; saldo of rows 3..N updates instantly.
  2. Hit Enter on the last row's saída; a new empty row appears with day = `lastDay + 1`.
  3. Edit a value, reload the page; value persists.
  4. With real txs present, `Real` and `Δ` columns reflect them; `Δ` is red when overspent.
- [ ] **`evolution-chart.tsx`** and **`comparison-chart.tsx`** — Chart.js via `react-chartjs-2`, themed from CSS custom properties. QA: charts redraw after month add/edit; legend colors match Life OS tokens.
- [ ] **`add-month-dialog.tsx`** — `<input type="month">`, opening balance, two toggles (`Herdar do mês anterior`, `Auto-popular de assinaturas e contas`). On submit, POST `/months` then optionally POST `/months/{id}/seed`. QA: cancel closes without side effects; duplicate key surfaces a toast from the API 409.
- [ ] **`cash-flow-shell.tsx`** — orchestrator:
  - `useState` for months, entriesByMonth, currentMonthId.
  - `useMemo` for `computedEntries`, `summary`, `planVsRealByMonth` (calls pure functions).
  - Optimistic mutations with rollback. QA: throttle the API to 2 seconds via DevTools; edits feel instant, and an API failure restores the prior value with an error toast.

## Task 7 — Home forecast strip

- [ ] In `src/app/page.tsx`, load the next 30 days of planned `cashFlowEntries` (months whose `key` covers today and today+30).
- [ ] Render alongside `Próximos 7 dias`. Pip colors: `--good` for entrada, `--danger` for saída. Tooltip on hover.

**QA:** With seeded data, the strip shows pips on the right days; clicking a pip navigates to `/fluxo` with that month selected.

---

# Phase 5 — End-to-end QA

- [ ] `npm run test:run` — entire suite green.
- [ ] `npm run build` — no type/lint errors.
- [ ] Manual walk-through:
  1. Fresh DB. Add May 2026 with `inheritOpening` off, openingBalance 1000. Confirm summary `closingBalance` = 1000.
  2. Run the existing Pluggy sync; subscriptions and bills populate. Hit "Auto-popular" on May. Confirm planned saídas appear on each billingDay/dueDay.
  3. Re-run "Auto-popular" — confirm zero duplicates (idempotency).
  4. Add a manual entrada on 2026-05-15 of 5000. Saldo corrido on rows 15..N jumps.
  5. Add a real Pluggy transaction (or wait for the next sync). Confirm `Real` column shows it and `Δ` flips sign accordingly.
  6. Toggle topbar privacy mask — values respect `.mask`.
- [ ] Final commit:

```
git commit -m "feat(cashflow): UI shell + home forecast (manual-QA green)"
```

---

## Open decisions (resolve before Phase 1)

1. **Chart lib**: `chart.js` + `react-chartjs-2` (mockup-parity, ~80 KB). Default kept; switch to inline SVG only if a bundle audit demands it.
2. **Opening-balance semantics**: persist `openingBalance` snapshot on creation; `inheritOpening` is a *user intent flag* used only at creation time. Do not recompute cascade on every edit.
3. **Plan-vs-real source of truth**: `transactions.amount` (negative = saída), grouped by `date`, excluding `type === 'transfer'`. Real-side **sign-flipped** so it matches planned saída polarity.
4. **Route name**: `/fluxo` (kept).
5. **Toasts**: lift the mockup's `showToast` into `src/lib/toast.ts` and reuse; if no other page wants it yet, that's fine — it's local to `/fluxo`.

---

## Out of scope (next iterations)

- Recurring planned entries within a single month (weekly groceries) — handled today by re-typing.
- Multi-currency.
- Per-entry budget categories tied to `transactions.category` rollups.
- AI projection of next month's plan from last 3 months of Pluggy data.
- jsdom-based UI tests (deferred until UI complexity warrants).
