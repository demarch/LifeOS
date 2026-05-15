# invest-core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build sub-project #1 of the investments roadmap: position tracking via Pluggy, quote refresh via HG Brasil Finance, daily portfolio snapshots, and a `/invest` page with KPI cards, allocation donut, evolution line, and positions table.

**Architecture:** Three new tables (`positions`, `quotes_cache`, `portfolio_snapshots`) decoupled from the cash-flow tables. Pure-domain functions in `src/lib/invest/` (TDD with Vitest, following the `src/lib/cashflow.ts` pattern). Thin API routes orchestrating sync. Server-rendered page with two client components for Chart.js charts and one for the refresh button.

**Tech Stack:** Next.js 14 (App Router), TypeScript 5, Drizzle ORM, better-sqlite3, Vitest, Chart.js, react-chartjs-2, pluggy-sdk.

**Spec:** `docs/superpowers/specs/2026-05-13-invest-core-design.md`

**Branch:** `feat/invest-core`

---

## File Structure

**Create:**
- `src/lib/invest/types.ts` — `AssetClass`, `Position`, `Quote`, `Snapshot`, error classes
- `src/lib/invest/config.ts` — env validation (`HG_BRASIL_KEY`)
- `src/lib/invest/positions.ts` — pure domain functions over positions
- `src/lib/invest/hg-client.ts` — HG Brasil HTTP client + parser
- `src/lib/invest/quotes.ts` — refresh loop + cache TTL
- `src/lib/invest/pluggy-invest.ts` — expand `pluggy-sdk.fetchInvestments` into positions
- `src/lib/invest/snapshot.ts` — aggregate + UPSERT daily snapshot
- `src/lib/invest/index.ts` — barrel exports
- `src/app/api/invest/positions/route.ts` — GET positions
- `src/app/api/invest/refresh/route.ts` — POST refresh pipeline
- `src/app/api/invest/snapshots/route.ts` — GET historical snapshots
- `src/app/invest/page.tsx` — route
- `src/components/pages/invest/invest-shell.tsx` — layout composer (client)
- `src/components/pages/invest/kpi-cards.tsx` — server
- `src/components/pages/invest/positions-table.tsx` — server
- `src/components/pages/invest/allocation-pie.tsx` — client (Chart.js donut)
- `src/components/pages/invest/evolution-line.tsx` — client (Chart.js line)
- `src/components/pages/invest/refresh-button.tsx` — client
- `src/__tests__/invest-positions.test.ts`
- `src/__tests__/invest-snapshot.test.ts`
- `src/__tests__/invest-quotes.test.ts`
- `src/__tests__/invest-hg-client.test.ts`
- `src/__tests__/invest-pluggy.test.ts`
- `src/lib/invest/__fixtures__/pluggy-invest-stocks.json`
- `src/lib/invest/__fixtures__/pluggy-invest-fixed.json`
- `src/lib/invest/__fixtures__/hg-stock-petr4.json`
- `src/lib/invest/__fixtures__/hg-ticker-not-found.json`

**Modify:**
- `src/db/schema.ts` — append three table definitions + types
- `src/components/shell/sidebar.tsx` — add Investimentos nav entry
- `.env.local` — add `HG_BRASIL_KEY=...` (developer task, outside the diff)

The icon `trending` already exists in `src/components/atoms/icon.tsx`; the sidebar entry reuses it.

---

## Task 1: Schema additions for positions, quotes_cache, portfolio_snapshots

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Append the three table definitions and inferred types**

Open `src/db/schema.ts` and append at the end of the file (after the existing `cashFlowEntries` export, before the type-only `export type` block):

```ts
export const positions = sqliteTable('positions', {
  id:            text('id').primaryKey(),
  pluggyId:      text('pluggy_id').unique(),
  accountId:     text('account_id').references(() => accounts.id),
  ticker:        text('ticker').notNull(),
  name:          text('name').notNull(),
  assetClass:    text('asset_class').notNull(),
  quantity:      real('quantity').notNull(),
  avgPrice:      real('avg_price').notNull(),
  currentValue: real('current_value').notNull(),
  lastQuote:     real('last_quote'),
  lastQuoteAt:   integer('last_quote_at'),
  updatedAt:     integer('updated_at').notNull(),
});

export const quotesCache = sqliteTable('quotes_cache', {
  ticker:        text('ticker').primaryKey(),
  price:         real('price').notNull(),
  changePercent: real('change_percent'),
  fetchedAt:     integer('fetched_at').notNull(),
});

export const portfolioSnapshots = sqliteTable('portfolio_snapshots', {
  id:               text('id').primaryKey(),
  snapshotDate:     text('snapshot_date').notNull().unique(),
  totalValue:       real('total_value').notNull(),
  stocksValue:      real('stocks_value').notNull(),
  fiisValue:        real('fiis_value').notNull(),
  fixedIncomeValue: real('fixed_income_value').notNull(),
  totalCost:        real('total_cost').notNull(),
  createdAt:        integer('created_at').notNull(),
});
```

Then append below the existing `export type` block:

```ts
export type Position           = typeof positions.$inferSelect;
export type QuoteCacheEntry    = typeof quotesCache.$inferSelect;
export type PortfolioSnapshot  = typeof portfolioSnapshots.$inferSelect;
```

- [ ] **Step 2: Apply schema to the local SQLite database**

Run: `npm run db:push`
Expected: drizzle-kit reports three new tables created with no warnings about destructive changes.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(invest): add positions, quotes_cache, portfolio_snapshots schema"
```

---

## Task 2: Types and error classes

**Files:**
- Create: `src/lib/invest/types.ts`

- [ ] **Step 1: Create the types module**

Create `src/lib/invest/types.ts`:

```ts
export type AssetClass = 'stock' | 'fii' | 'fixed_income';

export interface HgQuote {
  ticker: string;
  price: number;
  changePercent: number | null;
}

export interface ClassTotals {
  total: number;
  stocks: number;
  fiis: number;
  fixedIncome: number;
}

export class HgAuthError extends Error {
  constructor(msg = 'HG Brasil rejected the API key') {
    super(msg);
    this.name = 'HgAuthError';
  }
}

export class HgRateLimitError extends Error {
  constructor(msg = 'HG Brasil daily rate limit reached') {
    super(msg);
    this.name = 'HgRateLimitError';
  }
}

export class PluggyItemError extends Error {
  constructor(public itemId: string, msg: string) {
    super(`Pluggy item ${itemId}: ${msg}`);
    this.name = 'PluggyItemError';
  }
}
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/invest/types.ts
git commit -m "feat(invest): types and typed errors for invest module"
```

---

## Task 3: `classifyAsset` pure function (TDD)

**Files:**
- Create: `src/__tests__/invest-positions.test.ts`
- Create: `src/lib/invest/positions.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/invest-positions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyAsset } from '@/lib/invest/positions';

describe('classifyAsset', () => {
  it('returns "stock" for a 4-letter + 1-2 digit B3 code that is not a FII', () => {
    expect(classifyAsset({ code: 'PETR4', type: 'EQUITY', subtype: null, name: 'Petrobras PN' })).toBe('stock');
    expect(classifyAsset({ code: 'VALE3', type: 'EQUITY', subtype: null, name: 'Vale ON' })).toBe('stock');
  });

  it('returns "fii" for a code ending in 11', () => {
    expect(classifyAsset({ code: 'HGLG11', type: 'EQUITY', subtype: 'FII', name: 'HGLG' })).toBe('fii');
    expect(classifyAsset({ code: 'MXRF11', type: 'EQUITY', subtype: null, name: 'MXRF' })).toBe('fii');
  });

  it('returns "fixed_income" when type is FIXED_INCOME', () => {
    expect(classifyAsset({ code: null, type: 'FIXED_INCOME', subtype: 'CDB', name: 'CDB 100% CDI' })).toBe('fixed_income');
  });

  it('returns "fixed_income" for known fixed-income subtypes regardless of type', () => {
    for (const subtype of ['CDB', 'LCI', 'LCA', 'TESOURO', 'LC']) {
      expect(classifyAsset({ code: null, type: 'OTHER', subtype, name: subtype })).toBe('fixed_income');
    }
  });

  it('falls back to "fixed_income" when the code is malformed', () => {
    expect(classifyAsset({ code: 'XYZ', type: 'OTHER', subtype: null, name: 'unknown' })).toBe('fixed_income');
    expect(classifyAsset({ code: null, type: 'OTHER', subtype: null, name: 'unknown' })).toBe('fixed_income');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/invest-positions.test.ts`
Expected: FAIL — module `@/lib/invest/positions` not found.

- [ ] **Step 3: Implement `classifyAsset`**

Create `src/lib/invest/positions.ts`:

```ts
import type { AssetClass } from './types';

const FIXED_SUBTYPES = new Set(['CDB', 'LCI', 'LCA', 'TESOURO', 'LC']);
const FII_RE = /^[A-Z]{4}11$/;
const STOCK_RE = /^[A-Z]{4}\d{1,2}$/;

export interface ClassifierInput {
  code: string | null;
  type: string | null;
  subtype: string | null;
  name: string;
}

export function classifyAsset(inv: ClassifierInput): AssetClass {
  if (inv.type === 'FIXED_INCOME') return 'fixed_income';
  if (inv.subtype && FIXED_SUBTYPES.has(inv.subtype)) return 'fixed_income';
  if (inv.code && FII_RE.test(inv.code)) return 'fii';
  if (inv.code && STOCK_RE.test(inv.code)) return 'stock';
  return 'fixed_income';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/invest-positions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/invest-positions.test.ts src/lib/invest/positions.ts
git commit -m "feat(invest): classifyAsset pure classifier with tests"
```

---

## Task 4: `computePositionValue` and `computeGainLoss` (TDD)

**Files:**
- Modify: `src/__tests__/invest-positions.test.ts`
- Modify: `src/lib/invest/positions.ts`

- [ ] **Step 1: Append the failing tests**

Append to `src/__tests__/invest-positions.test.ts` (after the existing `describe` block):

```ts
import { computePositionValue, computeGainLoss } from '@/lib/invest/positions';

describe('computePositionValue', () => {
  it('stock: quantity times latest quote', () => {
    expect(computePositionValue({ assetClass: 'stock', quantity: 100, lastQuote: 38.40, pluggyBalance: null })).toBe(3840);
  });

  it('fii: quantity times latest quote', () => {
    expect(computePositionValue({ assetClass: 'fii', quantity: 50, lastQuote: 172.30, pluggyBalance: null })).toBe(50 * 172.30);
  });

  it('fixed_income: uses pluggyBalance directly, ignores quote', () => {
    expect(computePositionValue({ assetClass: 'fixed_income', quantity: 1, lastQuote: 999, pluggyBalance: 12345.67 })).toBe(12345.67);
  });

  it('stock without quote: returns 0 (caller must supply previous lastQuote)', () => {
    expect(computePositionValue({ assetClass: 'stock', quantity: 100, lastQuote: null, pluggyBalance: null })).toBe(0);
  });
});

describe('computeGainLoss', () => {
  it('positive when currentValue exceeds invested cost', () => {
    expect(computeGainLoss({ currentValue: 4000, quantity: 100, avgPrice: 30 })).toBe(1000);
  });

  it('negative when currentValue is below invested cost', () => {
    expect(computeGainLoss({ currentValue: 2500, quantity: 100, avgPrice: 30 })).toBe(-500);
  });

  it('zero when currentValue matches cost', () => {
    expect(computeGainLoss({ currentValue: 3000, quantity: 100, avgPrice: 30 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run src/__tests__/invest-positions.test.ts`
Expected: FAIL — `computePositionValue`/`computeGainLoss` not exported.

- [ ] **Step 3: Implement the two functions**

Append to `src/lib/invest/positions.ts`:

```ts
export interface PositionValueInput {
  assetClass: AssetClass;
  quantity: number;
  lastQuote: number | null;
  pluggyBalance: number | null;
}

export function computePositionValue(p: PositionValueInput): number {
  if (p.assetClass === 'fixed_income') return p.pluggyBalance ?? 0;
  if (p.lastQuote == null) return 0;
  return p.quantity * p.lastQuote;
}

export interface GainLossInput {
  currentValue: number;
  quantity: number;
  avgPrice: number;
}

export function computeGainLoss(p: GainLossInput): number {
  return p.currentValue - p.quantity * p.avgPrice;
}
```

- [ ] **Step 4: Run all positions tests**

Run: `npx vitest run src/__tests__/invest-positions.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/invest-positions.test.ts src/lib/invest/positions.ts
git commit -m "feat(invest): computePositionValue and computeGainLoss"
```

---

## Task 5: `aggregateByClass` and `computeTotalCost` (TDD)

**Files:**
- Create: `src/__tests__/invest-snapshot.test.ts`
- Create: `src/lib/invest/snapshot.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/invest-snapshot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { aggregateByClass, computeTotalCost } from '@/lib/invest/snapshot';

interface PosLike {
  assetClass: 'stock' | 'fii' | 'fixed_income';
  currentValue: number;
  quantity: number;
  avgPrice: number;
}

const mk = (over: Partial<PosLike>): PosLike => ({
  assetClass: 'stock',
  currentValue: 0,
  quantity: 0,
  avgPrice: 0,
  ...over,
});

describe('aggregateByClass', () => {
  it('sums currentValue per asset class and exposes total', () => {
    const result = aggregateByClass([
      mk({ assetClass: 'stock', currentValue: 1000 }),
      mk({ assetClass: 'stock', currentValue: 500 }),
      mk({ assetClass: 'fii', currentValue: 2000 }),
      mk({ assetClass: 'fixed_income', currentValue: 750 }),
    ]);
    expect(result.stocks).toBe(1500);
    expect(result.fiis).toBe(2000);
    expect(result.fixedIncome).toBe(750);
    expect(result.total).toBe(4250);
  });

  it('returns zeros for empty input', () => {
    expect(aggregateByClass([])).toEqual({ total: 0, stocks: 0, fiis: 0, fixedIncome: 0 });
  });

  it('returns zero for a class with no positions', () => {
    const result = aggregateByClass([mk({ assetClass: 'stock', currentValue: 100 })]);
    expect(result.fiis).toBe(0);
    expect(result.fixedIncome).toBe(0);
  });
});

describe('computeTotalCost', () => {
  it('sums quantity * avgPrice across positions', () => {
    expect(computeTotalCost([
      mk({ quantity: 100, avgPrice: 30 }),
      mk({ quantity: 50, avgPrice: 160 }),
    ])).toBe(100 * 30 + 50 * 160);
  });

  it('returns 0 for empty input', () => {
    expect(computeTotalCost([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/invest-snapshot.test.ts`
Expected: FAIL — `@/lib/invest/snapshot` not found.

- [ ] **Step 3: Implement the two pure functions**

Create `src/lib/invest/snapshot.ts`:

```ts
import type { AssetClass, ClassTotals } from './types';

export interface AggregateInput {
  assetClass: AssetClass;
  currentValue: number;
}

export function aggregateByClass(positions: AggregateInput[]): ClassTotals {
  const totals: ClassTotals = { total: 0, stocks: 0, fiis: 0, fixedIncome: 0 };
  for (const p of positions) {
    totals.total += p.currentValue;
    if (p.assetClass === 'stock') totals.stocks += p.currentValue;
    else if (p.assetClass === 'fii') totals.fiis += p.currentValue;
    else totals.fixedIncome += p.currentValue;
  }
  return totals;
}

export interface CostInput {
  quantity: number;
  avgPrice: number;
}

export function computeTotalCost(positions: CostInput[]): number {
  return positions.reduce((sum, p) => sum + p.quantity * p.avgPrice, 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/invest-snapshot.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/invest-snapshot.test.ts src/lib/invest/snapshot.ts
git commit -m "feat(invest): aggregateByClass and computeTotalCost"
```

---

## Task 6: HG Brasil client with mocked fetch (TDD)

**Files:**
- Create: `src/lib/invest/__fixtures__/hg-stock-petr4.json`
- Create: `src/lib/invest/__fixtures__/hg-ticker-not-found.json`
- Create: `src/__tests__/invest-hg-client.test.ts`
- Create: `src/lib/invest/hg-client.ts`

- [ ] **Step 1: Add the fixtures**

Create `src/lib/invest/__fixtures__/hg-stock-petr4.json`:

```json
{
  "by": "default",
  "valid_key": true,
  "results": {
    "PETR4": {
      "name": "Petrobras PN",
      "symbol": "PETR4",
      "region": "BR",
      "currency": "BRL",
      "price": 38.4,
      "change_percent": 1.23,
      "updated_at": "2026-05-13 14:30:00"
    }
  }
}
```

Create `src/lib/invest/__fixtures__/hg-ticker-not-found.json`:

```json
{
  "by": "default",
  "valid_key": true,
  "results": {
    "XYZW9": {
      "error": true,
      "message": "Symbol not found"
    }
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/__tests__/invest-hg-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchQuote } from '@/lib/invest/hg-client';
import { HgAuthError, HgRateLimitError } from '@/lib/invest/types';
import petr4 from '@/lib/invest/__fixtures__/hg-stock-petr4.json';
import notFound from '@/lib/invest/__fixtures__/hg-ticker-not-found.json';

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.HG_BRASIL_KEY = 'test-key';
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
});

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  ) as unknown as typeof fetch;
}

describe('fetchQuote', () => {
  it('parses price and change_percent for a valid ticker', async () => {
    mockFetchOnce(200, petr4);
    const quote = await fetchQuote('PETR4');
    expect(quote).toEqual({ ticker: 'PETR4', price: 38.4, changePercent: 1.23 });
  });

  it('returns null when the ticker is reported as not found by HG', async () => {
    mockFetchOnce(200, notFound);
    const quote = await fetchQuote('XYZW9');
    expect(quote).toBeNull();
  });

  it('throws HgAuthError on status 401', async () => {
    mockFetchOnce(401, { error: true, message: 'invalid key' });
    await expect(fetchQuote('PETR4')).rejects.toBeInstanceOf(HgAuthError);
  });

  it('throws HgRateLimitError on status 429', async () => {
    mockFetchOnce(429, { error: true, message: 'rate limit' });
    await expect(fetchQuote('PETR4')).rejects.toBeInstanceOf(HgRateLimitError);
  });

  it('retries once on network failure before propagating the error', async () => {
    let calls = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) return Promise.reject(new Error('network down'));
      return Promise.resolve(new Response(JSON.stringify(petr4), { status: 200 }));
    }) as unknown as typeof fetch;
    const quote = await fetchQuote('PETR4');
    expect(calls).toBe(2);
    expect(quote?.price).toBe(38.4);
  });
});
```

- [ ] **Step 3: Verify the tests fail**

Run: `npx vitest run src/__tests__/invest-hg-client.test.ts`
Expected: FAIL — `@/lib/invest/hg-client` not found.

- [ ] **Step 4: Enable JSON imports in TypeScript if needed**

Open `tsconfig.json`. If `compilerOptions.resolveJsonModule` is not present or false, set it to `true`. Skip if already set. Verify by running:

`node -e "console.log(require('./tsconfig.json').compilerOptions.resolveJsonModule)"`
Expected: `true`.

- [ ] **Step 5: Implement `fetchQuote`**

Create `src/lib/invest/hg-client.ts`:

```ts
import { HgAuthError, HgRateLimitError, type HgQuote } from './types';

const ENDPOINT = 'https://api.hgbrasil.com/finance/stock_price';
const RETRY_DELAY_MS = 500;

interface HgRawResult {
  results?: Record<string, {
    price?: number;
    change_percent?: number;
    error?: boolean;
    message?: string;
  }>;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchQuote(ticker: string): Promise<HgQuote | null> {
  const key = process.env.HG_BRASIL_KEY;
  if (!key) throw new HgAuthError('HG_BRASIL_KEY is not set');

  const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&symbol=${encodeURIComponent(ticker)}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 401) throw new HgAuthError();
      if (res.status === 429) throw new HgRateLimitError();
      if (!res.ok) throw new Error(`HG Brasil HTTP ${res.status}`);
      const body = (await res.json()) as HgRawResult;
      const entry = body.results?.[ticker];
      if (!entry || entry.error) return null;
      if (typeof entry.price !== 'number') return null;
      return {
        ticker,
        price: entry.price,
        changePercent: typeof entry.change_percent === 'number' ? entry.change_percent : null,
      };
    } catch (err) {
      if (err instanceof HgAuthError || err instanceof HgRateLimitError) throw err;
      lastErr = err;
      if (attempt === 0) await delay(RETRY_DELAY_MS);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('HG Brasil request failed');
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/__tests__/invest-hg-client.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add src/__tests__/invest-hg-client.test.ts src/lib/invest/hg-client.ts src/lib/invest/__fixtures__/hg-stock-petr4.json src/lib/invest/__fixtures__/hg-ticker-not-found.json tsconfig.json
git commit -m "feat(invest): hg-client with retry and typed errors"
```

(If `tsconfig.json` was not modified, drop it from the `git add`.)

---

## Task 7: `config.ts` env validation

**Files:**
- Create: `src/lib/invest/config.ts`

- [ ] **Step 1: Write the config module**

Create `src/lib/invest/config.ts`:

```ts
export interface InvestConfig {
  hgKey: string;
  pluggyClientId: string;
  pluggyClientSecret: string;
  pluggyItemIds: string[];
}

export function loadConfig(): InvestConfig {
  const missing: string[] = [];
  const hgKey = process.env.HG_BRASIL_KEY ?? '';
  const pluggyClientId = process.env.PLUGGY_CLIENT_ID ?? '';
  const pluggyClientSecret = process.env.PLUGGY_CLIENT_SECRET ?? '';
  const itemsRaw = process.env.PLUGGY_ITEM_IDS ?? '';

  if (!hgKey) missing.push('HG_BRASIL_KEY');
  if (!pluggyClientId) missing.push('PLUGGY_CLIENT_ID');
  if (!pluggyClientSecret) missing.push('PLUGGY_CLIENT_SECRET');
  if (!itemsRaw) missing.push('PLUGGY_ITEM_IDS');

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  return {
    hgKey,
    pluggyClientId,
    pluggyClientSecret,
    pluggyItemIds: itemsRaw.split(',').map(s => s.trim()).filter(Boolean),
  };
}
```

- [ ] **Step 2: Verify type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/invest/config.ts
git commit -m "feat(invest): env validation for HG and Pluggy"
```

---

## Task 8: `pluggy-invest.ts` — extract positions from Pluggy investments (TDD with mocked SDK)

**Files:**
- Create: `src/lib/invest/__fixtures__/pluggy-invest-stocks.json`
- Create: `src/lib/invest/__fixtures__/pluggy-invest-fixed.json`
- Create: `src/__tests__/invest-pluggy.test.ts`
- Create: `src/lib/invest/pluggy-invest.ts`

- [ ] **Step 1: Add the fixtures**

Create `src/lib/invest/__fixtures__/pluggy-invest-stocks.json`:

```json
[
  {
    "id": "pluggy-pos-1",
    "code": "PETR4",
    "name": "Petrobras PN",
    "type": "EQUITY",
    "subtype": null,
    "quantity": 100,
    "amount": 3000,
    "balance": 3840,
    "amountWithdrawal": 3840,
    "status": "ACTIVE",
    "issuer": "B3"
  },
  {
    "id": "pluggy-pos-2",
    "code": "HGLG11",
    "name": "CSHG Logística",
    "type": "EQUITY",
    "subtype": "FII",
    "quantity": 50,
    "amount": 8025,
    "balance": 8615,
    "amountWithdrawal": 8615,
    "status": "ACTIVE",
    "issuer": "B3"
  }
]
```

Create `src/lib/invest/__fixtures__/pluggy-invest-fixed.json`:

```json
[
  {
    "id": "pluggy-pos-3",
    "code": null,
    "name": "CDB 100% CDI",
    "type": "FIXED_INCOME",
    "subtype": "CDB",
    "quantity": 1,
    "amount": 10000,
    "balance": 11250.55,
    "amountWithdrawal": 11250.55,
    "status": "ACTIVE",
    "issuer": "Banco X",
    "rate": 100,
    "rateType": "CDI"
  },
  {
    "id": "pluggy-pos-4",
    "code": null,
    "name": "Tesouro IPCA+ 2035",
    "type": "FIXED_INCOME",
    "subtype": "TESOURO",
    "quantity": 1,
    "amount": 5000,
    "balance": 5310.10,
    "amountWithdrawal": 5310.10,
    "status": "ACTIVE",
    "issuer": "Tesouro Nacional"
  }
]
```

- [ ] **Step 2: Write the failing tests**

Create `src/__tests__/invest-pluggy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapInvestmentToPosition } from '@/lib/invest/pluggy-invest';
import stocks from '@/lib/invest/__fixtures__/pluggy-invest-stocks.json';
import fixed from '@/lib/invest/__fixtures__/pluggy-invest-fixed.json';

describe('mapInvestmentToPosition', () => {
  it('maps a stock investment to a "stock" position with ticker', () => {
    const pos = mapInvestmentToPosition(stocks[0]);
    expect(pos.assetClass).toBe('stock');
    expect(pos.ticker).toBe('PETR4');
    expect(pos.quantity).toBe(100);
    expect(pos.avgPrice).toBe(30);
    expect(pos.currentValue).toBe(3840);
    expect(pos.pluggyId).toBe('pluggy-pos-1');
    expect(pos.name).toBe('Petrobras PN');
  });

  it('maps an FII (subtype FII or code suffix 11) to "fii"', () => {
    const pos = mapInvestmentToPosition(stocks[1]);
    expect(pos.assetClass).toBe('fii');
    expect(pos.ticker).toBe('HGLG11');
  });

  it('maps a CDB to "fixed_income" with name as ticker and currentValue = balance', () => {
    const pos = mapInvestmentToPosition(fixed[0]);
    expect(pos.assetClass).toBe('fixed_income');
    expect(pos.ticker).toBe('CDB 100% CDI');
    expect(pos.currentValue).toBe(11250.55);
    expect(pos.lastQuote).toBeNull();
  });

  it('maps a Tesouro to "fixed_income"', () => {
    const pos = mapInvestmentToPosition(fixed[1]);
    expect(pos.assetClass).toBe('fixed_income');
    expect(pos.ticker).toBe('Tesouro IPCA+ 2035');
    expect(pos.currentValue).toBe(5310.10);
  });

  it('computes avgPrice as amount / quantity (or 0 if quantity is 0)', () => {
    expect(mapInvestmentToPosition({ ...stocks[0], quantity: 0 } as typeof stocks[0]).avgPrice).toBe(0);
  });
});
```

- [ ] **Step 3: Verify the tests fail**

Run: `npx vitest run src/__tests__/invest-pluggy.test.ts`
Expected: FAIL — `@/lib/invest/pluggy-invest` not found.

- [ ] **Step 4: Implement `mapInvestmentToPosition`**

Create `src/lib/invest/pluggy-invest.ts`:

```ts
import { classifyAsset } from './positions';
import type { AssetClass } from './types';

export interface PluggyInvestment {
  id: string;
  code: string | null;
  name: string;
  type: string | null;
  subtype: string | null;
  quantity: number;
  amount: number;
  balance: number | null;
  amountWithdrawal?: number | null;
  status: string;
  issuer?: string;
}

export interface MappedPosition {
  pluggyId: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  avgPrice: number;
  currentValue: number;
  lastQuote: number | null;
}

export function mapInvestmentToPosition(inv: PluggyInvestment): MappedPosition {
  const assetClass = classifyAsset({
    code: inv.code,
    type: inv.type,
    subtype: inv.subtype,
    name: inv.name,
  });
  const quantity = inv.quantity ?? 0;
  const amount = inv.amount ?? 0;
  const balance = inv.balance ?? inv.amountWithdrawal ?? 0;
  const avgPrice = quantity > 0 ? amount / quantity : 0;

  const isMarket = assetClass === 'stock' || assetClass === 'fii';
  const ticker = isMarket && inv.code ? inv.code : inv.name;

  return {
    pluggyId: inv.id,
    ticker,
    name: inv.name,
    assetClass,
    quantity,
    avgPrice,
    currentValue: balance,
    lastQuote: null,
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/__tests__/invest-pluggy.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/invest-pluggy.test.ts src/lib/invest/pluggy-invest.ts src/lib/invest/__fixtures__/pluggy-invest-stocks.json src/lib/invest/__fixtures__/pluggy-invest-fixed.json
git commit -m "feat(invest): map Pluggy investments to positions"
```

---

## Task 9: `syncPositions` — orchestrate Pluggy fetch and DB upsert

**Files:**
- Modify: `src/lib/invest/pluggy-invest.ts`

- [ ] **Step 1: Append the orchestration function**

Append to `src/lib/invest/pluggy-invest.ts`:

```ts
import { PluggyClient } from 'pluggy-sdk';
import { randomUUID } from 'crypto';
import { db } from '@/db/client';
import { positions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PluggyItemError } from './types';

export interface SyncPositionsResult {
  synced: number;
  errors: string[];
}

interface ClientShim {
  fetchInvestments: (itemId: string) => Promise<{ results: PluggyInvestment[] }>;
}

export async function syncPositions(
  itemIds: string[],
  clientFactory?: () => ClientShim
): Promise<SyncPositionsResult> {
  const client = clientFactory
    ? clientFactory()
    : (new PluggyClient({
        clientId: process.env.PLUGGY_CLIENT_ID!,
        clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
      }) as unknown as ClientShim);

  const now = Math.floor(Date.now() / 1000);
  let synced = 0;
  const errors: string[] = [];

  for (const itemId of itemIds) {
    try {
      const { results } = await client.fetchInvestments(itemId);
      for (const inv of results) {
        if (inv.status !== 'ACTIVE') continue;
        const mapped = mapInvestmentToPosition(inv);
        const existing = db.select().from(positions).where(eq(positions.pluggyId, mapped.pluggyId)).get();
        if (existing) {
          db.update(positions).set({
            ticker:       mapped.ticker,
            name:         mapped.name,
            assetClass:   mapped.assetClass,
            quantity:     mapped.quantity,
            avgPrice:     mapped.avgPrice,
            currentValue: mapped.currentValue,
            updatedAt:    now,
          }).where(eq(positions.pluggyId, mapped.pluggyId)).run();
        } else {
          db.insert(positions).values({
            id:           randomUUID(),
            pluggyId:     mapped.pluggyId,
            accountId:    null,
            ticker:       mapped.ticker,
            name:         mapped.name,
            assetClass:   mapped.assetClass,
            quantity:     mapped.quantity,
            avgPrice:     mapped.avgPrice,
            currentValue: mapped.currentValue,
            lastQuote:    null,
            lastQuoteAt:  null,
            updatedAt:    now,
          }).run();
        }
        synced++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(new PluggyItemError(itemId, msg).message);
    }
  }

  return { synced, errors };
}
```

- [ ] **Step 2: Verify type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/invest/pluggy-invest.ts
git commit -m "feat(invest): syncPositions orchestrates Pluggy fetch and upsert"
```

---

## Task 10: `quotes.ts` — refresh stock/FII quotes and update positions

**Files:**
- Modify: `src/__tests__/invest-quotes.test.ts` (create)
- Create: `src/lib/invest/quotes.ts`

- [ ] **Step 1: Write the failing test for the pure selection helper**

Create `src/__tests__/invest-quotes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { selectTickersToFetch } from '@/lib/invest/quotes';

interface PosRow {
  ticker: string;
  assetClass: 'stock' | 'fii' | 'fixed_income';
}

const p = (over: Partial<PosRow>): PosRow => ({ ticker: 'PETR4', assetClass: 'stock', ...over });

describe('selectTickersToFetch', () => {
  it('returns unique stock/FII tickers and skips fixed_income', () => {
    const tickers = selectTickersToFetch([
      p({ ticker: 'PETR4', assetClass: 'stock' }),
      p({ ticker: 'PETR4', assetClass: 'stock' }),
      p({ ticker: 'HGLG11', assetClass: 'fii' }),
      p({ ticker: 'CDB X', assetClass: 'fixed_income' }),
    ]);
    expect(tickers.sort()).toEqual(['HGLG11', 'PETR4']);
  });

  it('skips empty or whitespace-only tickers', () => {
    expect(selectTickersToFetch([
      p({ ticker: '', assetClass: 'stock' }),
      p({ ticker: '   ', assetClass: 'stock' }),
      p({ ticker: 'VALE3', assetClass: 'stock' }),
    ])).toEqual(['VALE3']);
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run src/__tests__/invest-quotes.test.ts`
Expected: FAIL — `@/lib/invest/quotes` not found.

- [ ] **Step 3: Implement quotes module**

Create `src/lib/invest/quotes.ts`:

```ts
import { db } from '@/db/client';
import { positions, quotesCache } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchQuote } from './hg-client';
import { HgAuthError, HgRateLimitError } from './types';

interface PositionRow {
  ticker: string;
  assetClass: 'stock' | 'fii' | 'fixed_income';
}

export function selectTickersToFetch(rows: PositionRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.assetClass === 'fixed_income') continue;
    const t = r.ticker?.trim();
    if (!t) continue;
    set.add(t);
  }
  return Array.from(set);
}

export interface RefreshAllResult {
  refreshed: number;
  skipped: number;
  warnings: string[];
}

export async function refreshAll(): Promise<RefreshAllResult> {
  const rows = db.select({ ticker: positions.ticker, assetClass: positions.assetClass })
    .from(positions).all() as PositionRow[];
  const tickers = selectTickersToFetch(rows);
  const now = Math.floor(Date.now() / 1000);
  let refreshed = 0;
  let skipped = 0;
  const warnings: string[] = [];

  for (const ticker of tickers) {
    try {
      const quote = await fetchQuote(ticker);
      if (!quote) {
        warnings.push(`HG: ticker ${ticker} not found`);
        skipped++;
        continue;
      }

      const existing = db.select().from(quotesCache).where(eq(quotesCache.ticker, ticker)).get();
      if (existing) {
        db.update(quotesCache).set({
          price: quote.price,
          changePercent: quote.changePercent,
          fetchedAt: now,
        }).where(eq(quotesCache.ticker, ticker)).run();
      } else {
        db.insert(quotesCache).values({
          ticker,
          price: quote.price,
          changePercent: quote.changePercent,
          fetchedAt: now,
        }).run();
      }

      const matchingPositions = db.select().from(positions).where(eq(positions.ticker, ticker)).all();
      for (const pos of matchingPositions) {
        if (pos.assetClass === 'fixed_income') continue;
        db.update(positions).set({
          lastQuote: quote.price,
          lastQuoteAt: now,
          currentValue: pos.quantity * quote.price,
          updatedAt: now,
        }).where(eq(positions.id, pos.id)).run();
      }
      refreshed++;
    } catch (err) {
      if (err instanceof HgAuthError || err instanceof HgRateLimitError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`HG: ${ticker} failed (${msg})`);
      skipped++;
    }
  }

  return { refreshed, skipped, warnings };
}
```

- [ ] **Step 4: Run the unit test**

Run: `npx vitest run src/__tests__/invest-quotes.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/invest-quotes.test.ts src/lib/invest/quotes.ts
git commit -m "feat(invest): quote refresh loop with HG client + cache"
```

---

## Task 11: `snapshot.persistToday` — UPSERT daily snapshot

**Files:**
- Modify: `src/lib/invest/snapshot.ts`

- [ ] **Step 1: Append `persistToday`**

Append to `src/lib/invest/snapshot.ts`:

```ts
import { db } from '@/db/client';
import { positions, portfolioSnapshots } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface PersistResult {
  snapshotDate: string;
  totalValue: number;
}

export async function persistToday(): Promise<PersistResult> {
  const rows = db.select({
    assetClass:   positions.assetClass,
    currentValue: positions.currentValue,
    quantity:     positions.quantity,
    avgPrice:     positions.avgPrice,
  }).from(positions).all();

  const totals = aggregateByClass(rows.map(r => ({ assetClass: r.assetClass as 'stock'|'fii'|'fixed_income', currentValue: r.currentValue })));
  const totalCost = computeTotalCost(rows);
  const date = today();
  const now = Math.floor(Date.now() / 1000);

  const existing = db.select().from(portfolioSnapshots).where(eq(portfolioSnapshots.snapshotDate, date)).get();
  if (existing) {
    db.update(portfolioSnapshots).set({
      totalValue:       totals.total,
      stocksValue:      totals.stocks,
      fiisValue:        totals.fiis,
      fixedIncomeValue: totals.fixedIncome,
      totalCost,
    }).where(eq(portfolioSnapshots.snapshotDate, date)).run();
  } else {
    db.insert(portfolioSnapshots).values({
      id:               randomUUID(),
      snapshotDate:     date,
      totalValue:       totals.total,
      stocksValue:      totals.stocks,
      fiisValue:        totals.fiis,
      fixedIncomeValue: totals.fixedIncome,
      totalCost,
      createdAt:        now,
    }).run();
  }

  return { snapshotDate: date, totalValue: totals.total };
}
```

- [ ] **Step 2: Verify type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/invest/snapshot.ts
git commit -m "feat(invest): persistToday upserts daily portfolio snapshot"
```

---

## Task 12: Barrel exports

**Files:**
- Create: `src/lib/invest/index.ts`

- [ ] **Step 1: Write the barrel**

Create `src/lib/invest/index.ts`:

```ts
export * from './types';
export * from './config';
export * from './positions';
export * from './hg-client';
export * from './quotes';
export * from './pluggy-invest';
export * from './snapshot';
```

- [ ] **Step 2: Verify type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/invest/index.ts
git commit -m "chore(invest): barrel exports for invest module"
```

---

## Task 13: API route — `POST /api/invest/refresh`

**Files:**
- Create: `src/app/api/invest/refresh/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/invest/refresh/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/invest/config';
import { syncPositions } from '@/lib/invest/pluggy-invest';
import { refreshAll } from '@/lib/invest/quotes';
import { persistToday } from '@/lib/invest/snapshot';
import { HgAuthError, HgRateLimitError } from '@/lib/invest/types';

export const dynamic = 'force-dynamic';

export async function POST() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'config error', code: 'CONFIG' },
      { status: 500 }
    );
  }

  const sync = await syncPositions(config.pluggyItemIds);

  let quotes;
  try {
    quotes = await refreshAll();
  } catch (err) {
    if (err instanceof HgAuthError) {
      return NextResponse.json({ ok: false, error: err.message, code: 'HG_AUTH' }, { status: 500 });
    }
    if (err instanceof HgRateLimitError) {
      return NextResponse.json({ ok: false, error: err.message, code: 'HG_RATE_LIMIT' }, { status: 503 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, code: 'HG_UNKNOWN' }, { status: 500 });
  }

  const snap = await persistToday();

  return NextResponse.json({
    ok: true,
    syncedPositions: sync.synced,
    refreshedQuotes: quotes.refreshed,
    skippedQuotes: quotes.skipped,
    snapshotDate: snap.snapshotDate,
    warnings: [...sync.errors, ...quotes.warnings],
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invest/refresh/route.ts
git commit -m "feat(invest): POST /api/invest/refresh pipeline"
```

---

## Task 14: API route — `GET /api/invest/positions`

**Files:**
- Create: `src/app/api/invest/positions/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/invest/positions/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { positions } from '@/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = db.select().from(positions).orderBy(desc(positions.currentValue)).all();
  return NextResponse.json({ ok: true, positions: rows });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invest/positions/route.ts
git commit -m "feat(invest): GET /api/invest/positions"
```

---

## Task 15: API route — `GET /api/invest/snapshots`

**Files:**
- Create: `src/app/api/invest/snapshots/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/invest/snapshots/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { portfolioSnapshots } from '@/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = db.select()
    .from(portfolioSnapshots)
    .orderBy(desc(portfolioSnapshots.snapshotDate))
    .limit(12)
    .all();
  return NextResponse.json({ ok: true, snapshots: rows });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invest/snapshots/route.ts
git commit -m "feat(invest): GET /api/invest/snapshots (last 12)"
```

---

## Task 16: Sidebar nav entry

**Files:**
- Modify: `src/components/shell/sidebar.tsx`

- [ ] **Step 1: Insert the Investimentos entry after Fluxo**

Open `src/components/shell/sidebar.tsx`. Change the `NAV` array:

```ts
const NAV = [
  { href: '/',             label: 'Início',         icon: 'home'     },
  { href: '/financas',     label: 'Finanças',       icon: 'wallet'   },
  { href: '/fluxo',        label: 'Fluxo',          icon: 'trending' },
  { href: '/invest',       label: 'Investimentos',  icon: 'trending' },
  { href: '/contas',       label: 'Contas',         icon: 'calendar' },
  { href: '/assinaturas',  label: 'Assinaturas',    icon: 'repeat'   },
  { href: '/lista',        label: 'Lista',          icon: 'cart'     },
];
```

- [ ] **Step 2: Verify the dev server still boots**

Run: `npm run dev` (in a separate terminal). Visit `http://localhost:3000`. Expected: sidebar shows new "Investimentos" entry; clicking it 404s (page not yet built). Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/sidebar.tsx
git commit -m "feat(invest): add Investimentos sidebar entry"
```

---

## Task 17: `kpi-cards.tsx` — patrimony and per-class cards

**Files:**
- Create: `src/components/pages/invest/kpi-cards.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/pages/invest/kpi-cards.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pages/invest/kpi-cards.tsx
git commit -m "feat(invest): KpiCards component"
```

---

## Task 18: `positions-table.tsx`

**Files:**
- Create: `src/components/pages/invest/positions-table.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/pages/invest/positions-table.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pages/invest/positions-table.tsx
git commit -m "feat(invest): PositionsTable component"
```

---

## Task 19: `allocation-pie.tsx` (client, Chart.js)

**Files:**
- Create: `src/components/pages/invest/allocation-pie.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/pages/invest/allocation-pie.tsx`:

```tsx
'use client';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import type { ClassTotals } from '@/lib/invest/types';

Chart.register(ArcElement, Tooltip, Legend);

interface AllocationPieProps {
  totals: ClassTotals;
}

export function AllocationPie({ totals }: AllocationPieProps) {
  const data = {
    labels: ['Ações', 'FIIs', 'Renda Fixa'],
    datasets: [{
      data: [totals.stocks, totals.fiis, totals.fixedIncome],
      backgroundColor: ['#22c55e', '#3b82f6', '#9ca3af'],
      borderColor: 'rgba(0,0,0,0)',
      borderWidth: 1,
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { color: '#cbd5e1' } } },
    cutout: '60%',
  };
  return (
    <div style={{ height: 260 }}>
      <Doughnut data={data} options={options} />
    </div>
  );
}
```

- [ ] **Step 2: Verify type-checks and that Chart.js is wired**

Run: `npx tsc --noEmit`
Expected: no errors. (`chart.js` and `react-chartjs-2` are already in `package.json`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/pages/invest/allocation-pie.tsx
git commit -m "feat(invest): AllocationPie donut chart"
```

---

## Task 20: `evolution-line.tsx` (client, Chart.js)

**Files:**
- Create: `src/components/pages/invest/evolution-line.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/pages/invest/evolution-line.tsx`:

```tsx
'use client';
import { Line } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import type { PortfolioSnapshot } from '@/db/schema';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface EvolutionLineProps {
  snapshots: PortfolioSnapshot[];
}

export function EvolutionLine({ snapshots }: EvolutionLineProps) {
  if (snapshots.length < 2) {
    return (
      <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', fontSize: 13 }}>
        Aguardando histórico (mín. 2 snapshots)
      </div>
    );
  }
  const ordered = [...snapshots].reverse();
  const data = {
    labels: ordered.map(s => s.snapshotDate),
    datasets: [{
      label: 'Patrimônio',
      data: ordered.map(s => s.totalValue),
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34,197,94,0.15)',
      fill: true,
      tension: 0.25,
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
    },
  };
  return (
    <div style={{ height: 260 }}>
      <Line data={data} options={options} />
    </div>
  );
}
```

- [ ] **Step 2: Verify type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pages/invest/evolution-line.tsx
git commit -m "feat(invest): EvolutionLine line chart"
```

---

## Task 21: `refresh-button.tsx` (client)

**Files:**
- Create: `src/components/pages/invest/refresh-button.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/pages/invest/refresh-button.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/lib/toast';

export function RefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/invest/refresh', { method: 'POST' });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        const msg = body.error ?? 'falha desconhecida';
        const code = body.code ?? 'ERROR';
        showToast(`Erro (${code}): ${msg}`, 'error', 6000);
        return;
      }
      const w = body.warnings?.length ? ` (${body.warnings.length} avisos)` : '';
      showToast(`Atualizado: ${body.syncedPositions} posições, ${body.refreshedQuotes} cotações${w}`, 'success');
      router.refresh();
    } catch (err) {
      showToast(`Erro de rede: ${err instanceof Error ? err.message : String(err)}`, 'error', 6000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} style={{
      padding: '8px 14px',
      borderRadius: 8,
      background: 'var(--accent)',
      color: '#0b0f14',
      border: 'none',
      fontSize: 13,
      fontWeight: 600,
      cursor: loading ? 'wait' : 'pointer',
      opacity: loading ? 0.6 : 1,
    }}>
      {loading ? 'Atualizando…' : 'Atualizar'}
    </button>
  );
}
```

- [ ] **Step 2: Verify type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pages/invest/refresh-button.tsx
git commit -m "feat(invest): RefreshButton with toast feedback"
```

---

## Task 22: `invest-shell.tsx` (client composer)

**Files:**
- Create: `src/components/pages/invest/invest-shell.tsx`

- [ ] **Step 1: Write the shell**

Create `src/components/pages/invest/invest-shell.tsx`:

```tsx
'use client';
import type { Position, PortfolioSnapshot } from '@/db/schema';
import type { ClassTotals } from '@/lib/invest/types';
import { KpiCards } from './kpi-cards';
import { PositionsTable } from './positions-table';
import { AllocationPie } from './allocation-pie';
import { EvolutionLine } from './evolution-line';
import { RefreshButton } from './refresh-button';

interface InvestShellProps {
  positions: Position[];
  snapshots: PortfolioSnapshot[];
  totals: ClassTotals;
  totalCost: number;
  lastSnapshotDate: string | null;
}

export function InvestShell({ positions, snapshots, totals, totalCost, lastSnapshotDate }: InvestShellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Investimentos</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
            Última: {lastSnapshotDate ?? '—'}
          </span>
          <RefreshButton />
        </div>
      </header>

      <KpiCards totals={totals} totalCost={totalCost} />

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>Alocação</div>
          <AllocationPie totals={totals} />
        </div>
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>Evolução</div>
          <EvolutionLine snapshots={snapshots} />
        </div>
      </section>

      <section style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>Posições</div>
        <PositionsTable positions={positions} total={totals.total} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/pages/invest/invest-shell.tsx
git commit -m "feat(invest): InvestShell composer"
```

---

## Task 23: `page.tsx` server component for `/invest`

**Files:**
- Create: `src/app/invest/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/invest/page.tsx`:

```tsx
import { db } from '@/db/client';
import { positions, portfolioSnapshots } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { aggregateByClass, computeTotalCost } from '@/lib/invest/snapshot';
import { InvestShell } from '@/components/pages/invest/invest-shell';

export const dynamic = 'force-dynamic';

export default function InvestPage() {
  const posRows = db.select().from(positions).orderBy(desc(positions.currentValue)).all();
  const snaps = db.select().from(portfolioSnapshots).orderBy(desc(portfolioSnapshots.snapshotDate)).limit(12).all();

  const totals = aggregateByClass(posRows.map(p => ({ assetClass: p.assetClass as 'stock'|'fii'|'fixed_income', currentValue: p.currentValue })));
  const totalCost = computeTotalCost(posRows);
  const lastSnapshotDate = snaps[0]?.snapshotDate ?? null;

  return (
    <InvestShell
      positions={posRows}
      snapshots={snaps}
      totals={totals}
      totalCost={totalCost}
      lastSnapshotDate={lastSnapshotDate}
    />
  );
}
```

- [ ] **Step 2: Run the dev server and check the page renders**

Run: `npm run dev`
Open `http://localhost:3000/invest`. Expected: page renders. With no data: 4 KPI cards showing R$ 0; donut empty; line shows "Aguardando histórico"; table shows empty-state message. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/invest/page.tsx
git commit -m "feat(invest): /invest page server component"
```

---

## Task 24: Full pre-merge verification

**Files:** none — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: all suites pass, including the 5 new invest test files (`invest-positions`, `invest-snapshot`, `invest-quotes`, `invest-hg-client`, `invest-pluggy`) plus all pre-existing cashflow tests.

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors. Some Next.js warnings about dynamic routes are acceptable.

- [ ] **Step 3: Smoke test against real environment**

Ensure `.env.local` contains `HG_BRASIL_KEY`, `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, and `PLUGGY_ITEM_IDS` (broker item included).

Run: `npm run dev`

Open `http://localhost:3000/invest` and click "Atualizar". Expected:
- Toast shows success with counts.
- Table populates with positions.
- KPI cards reflect new totals.
- Donut shows allocation.
- Refreshing the page leaves the line chart with at least one data point; a second refresh on another day will produce a second point.

If "⚠ sem cotação" or "⚠ desatualizado" badges appear, document the tickers in the PR description for triage in sub-project #2.

- [ ] **Step 4: Confirm branch state and prepare for review**

Run:
```bash
git log --oneline master..HEAD
git status
```
Expected: clean working tree; commit history shows the per-task commits from Tasks 1–23.

---

## Out of Scope (deferred to other sub-projects)

- Manual entry UI for positions when the broker has no Pluggy connector — schema is ready (`pluggy_id` nullable), but no form. If this blocks the user before sub-project #2, scope a small follow-on.
- Dividends history aggregation and yield calendar — sub-project #2.
- Target allocation and cash-flow rebalance suggestions — sub-project #3.
- CVM ETL pipeline and fundamentalist screener — sub-project #4.

## Intentionally deferred for MVP1

- **Writes to `sync_log` for invest refresh:** the spec calls out reuse of the existing `sync_log` table as optional with a `kind` column noted as a sub-project #2 concern. To avoid polluting the existing cash-flow sync log semantics (its `accountsSynced` / `transactionsSynced` columns mean accounts and transactions, not positions and quotes), `/api/invest/refresh` does not write to `sync_log` in MVP1. Errors surface via the API response body and the UI toast. Add a `kind` column and dedicated invest-sync rows in sub-project #2.
- **DB integration tests (`*.integration.test.ts`):** the spec lists these at "medium coverage". MVP1 ships with unit tests on the pure-domain functions (Tasks 3–6, 8, 10) plus the manual smoke test in Task 24. Add integration tests when the next sub-project introduces non-trivial query paths.
