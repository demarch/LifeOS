# invest-core — Design Spec

**Date:** 2026-05-13
**Branch:** `feat/invest-core`
**Status:** Draft (awaiting user review)
**Sub-project:** #1 of 4 in investments roadmap

---

## 1. Context & Scope

Adds an investments module to the Life OS. Sub-project #1 (`invest-core`) is the foundation: position tracking, current quotes, asset allocation snapshot, and patrimony evolution. The remaining sub-projects (dividends, allocation/rebalance, fundamentals) build on top of this and get their own spec → plan → implementation cycles.

### In scope (MVP1)

- Pluggy-driven sync of investment positions (stocks B3, FIIs, fixed income)
- Manual "Atualizar" button refreshes positions + quotes + writes daily snapshot
- HG Brasil Finance as quote provider (free tier; manual cadence)
- `/invest` page with 4 widgets: KPI cards, allocation donut, evolution line, positions table

### Out of scope (later sub-projects)

- Dividend history aggregation and yield calendar → #2 `invest-dividends`
- Target allocation + drift + cash-flow rebalance suggestions → #3 `invest-allocation`
- CVM ETL pipeline + fundamentalist screener (P/L, ROIC, P/VP) → #4 `invest-fundamentals`
- International assets (BDR/ETF/US stocks)
- Sell-side rebalance (full rebalancing)
- Per-asset or per-sector allocation granularity

### Success criteria

- After clicking "Atualizar", `/invest` shows current patrimony, allocation by class, list of positions with current quotes, and at least one snapshot row in evolution history.
- All `lib/invest/*.ts` modules have unit tests passing.
- No regression in existing cash-flow modules.
- `npm run build` + `npm run test:run` both green.

---

## 2. Architecture

### Module layout

```
src/db/schema.ts                      # + tables: positions, quotes_cache, portfolio_snapshots
src/lib/invest/
  types.ts                            # Position, Quote, Snapshot, AssetClass, error classes
  positions.ts                        # CRUD + pure domain functions (no I/O outside DB)
  hg-client.ts                        # HG Brasil HTTP client + parser
  quotes.ts                           # refresh + cache TTL logic
  snapshot.ts                         # aggregate by class + upsert daily snapshot
  pluggy-invest.ts                    # expand pluggy-sdk fetchInvestments → positions
src/app/api/invest/
  positions/route.ts                  # GET (list)
  refresh/route.ts                    # POST → run full refresh pipeline
  snapshots/route.ts                  # GET historical series
src/app/invest/page.tsx               # route
src/components/pages/invest/
  invest-shell.tsx                    # client; orchestrates layout + refresh button
  kpi-cards.tsx                       # server; 4 cards (total + 3 classes)
  allocation-pie.tsx                  # client; Chart.js donut
  evolution-line.tsx                  # client; Chart.js line
  positions-table.tsx                 # server; sortable by currentValue desc
  refresh-button.tsx                  # client; POST /api/invest/refresh + toast
src/components/shell/sidebar.tsx      # + nav item "Investimentos"
```

### Boundaries

- `lib/invest/*.ts` is pure domain logic plus DB access via Drizzle. No direct HTTP outside `hg-client.ts` and `pluggy-invest.ts`.
- `hg-client.ts` is the single integration point for HG Brasil. Replacing the provider means rewriting one file.
- `pluggy-invest.ts` is the single bridge to `pluggy-sdk` for investment data. The existing `lib/pluggy.ts` (cash-flow sync) is left untouched.
- API routes are thin: validate input, call lib, return JSON. No business logic.
- UI components consume server-rendered data; only refresh and chart components are client.

### Pattern alignment

Follows `src/lib/cashflow.ts`: pure functions in `lib/`, integration via API routes, tested with Vitest. The existing `lib/pluggy.ts` and `app/api/sync/route.ts` are reference patterns for sync orchestration.

---

## 3. Data Model

New tables in `src/db/schema.ts` (Drizzle, SQLite via `better-sqlite3`):

### `positions`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | uuid |
| `pluggy_id` | text UNIQUE | nullable; null = manual entry (rare) |
| `account_id` | text FK accounts.id | nullable; brokerage account when known |
| `ticker` | text NOT NULL | B3 code (PETR4, HGLG11); free text for fixed income (e.g. "CDB 100% CDI") |
| `name` | text NOT NULL | human-readable name |
| `asset_class` | text NOT NULL | enum: `'stock' \| 'fii' \| 'fixed_income'` |
| `quantity` | real NOT NULL | shares/units; for fixed income may be 1 |
| `avg_price` | real NOT NULL | BRL; for fixed income = invested principal |
| `current_value` | real NOT NULL | denormalised: `quantity * lastQuote` for stocks/FIIs, Pluggy balance for fixed income |
| `last_quote` | real | nullable; null for fixed income |
| `last_quote_at` | integer | unix ts; null when not yet fetched |
| `updated_at` | integer NOT NULL | unix ts |

### `quotes_cache`

| Column | Type | Notes |
|---|---|---|
| `ticker` | text PK | B3 code |
| `price` | real NOT NULL | last fetched price |
| `change_percent` | real | nullable |
| `fetched_at` | integer NOT NULL | unix ts |

### `portfolio_snapshots`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | uuid |
| `snapshot_date` | text NOT NULL UNIQUE | `YYYY-MM-DD`; one row per day; refresh same day = UPSERT |
| `total_value` | real NOT NULL | sum across all positions |
| `stocks_value` | real NOT NULL | sum where asset_class='stock' |
| `fiis_value` | real NOT NULL | sum where asset_class='fii' |
| `fixed_income_value` | real NOT NULL | sum where asset_class='fixed_income' |
| `total_cost` | real NOT NULL | sum(quantity * avg_price) — basis for gain/loss |
| `created_at` | integer NOT NULL | unix ts |

### Design decisions

- `asset_class` is a string enum, not a FK. Three fixed values; YAGNI dedicated table.
- `current_value` is denormalised in `positions` to avoid recomputation on every page render. The refresh pipeline updates it atomically.
- Fixed income positions skip quote fetch entirely; `current_value` comes from Pluggy's `amountWithdrawal` / `balance` field.
- `snapshot_date` is UNIQUE; multiple refreshes per day overwrite via UPSERT (no duplicate rows).
- `pluggy_id` UNIQUE allows idempotent reconciliation across syncs.
- `account_id` FK is optional; allows future grouping by brokerage without a migration.

### Migration

`npm run db:push` runs `drizzle-kit push` against the local SQLite. No data migration needed (new tables only).

---

## 4. Data Flow

### Flow 1: Refresh (button click)

```
[UI click "Atualizar"]
  └→ POST /api/invest/refresh
      ├→ pluggyInvest.syncPositions(itemIds from env)
      │   ├→ client.fetchInvestments(itemId) for each item
      │   ├→ classify each: subtype + code → assetClass ('stock' | 'fii' | 'fixed_income')
      │   ├→ upsert positions matched by pluggy_id
      │   └→ extract ticker via regex /^[A-Z]{4}\d{1,2}$/ from inv.code for stocks/FIIs; null for fixed income
      │
      ├→ quotes.refreshAll()
      │   ├→ collect distinct tickers from positions where asset_class IN ('stock','fii')
      │   ├→ for each ticker: HG GET /finance/stock_price?key=KEY&symbol=TICKER
      │   ├→ upsert quotes_cache (price, change_percent, fetched_at)
      │   └→ update positions.current_value = quantity * price
      │       (fixed income: current_value already set from Pluggy balance; skip)
      │
      └→ snapshot.persistToday()
          ├→ aggregate positions sum by asset_class
          ├→ compute total_cost = sum(quantity * avg_price)
          └→ UPSERT portfolio_snapshots WHERE snapshot_date = today (YYYY-MM-DD)
```

### Flow 2: Page render

```
[GET /invest]
  └→ src/app/invest/page.tsx (server component)
      ├→ db.select positions ORDER BY current_value DESC
      ├→ db.select portfolio_snapshots ORDER BY snapshot_date DESC LIMIT 12
      └→ render invest-shell with data; client widgets receive props
```

### Ticker mapping & classification

```ts
function classifyAsset(inv: PluggyInvestment): AssetClass {
  if (inv.type === 'FIXED_INCOME' ||
      ['CDB', 'LCI', 'LCA', 'TESOURO', 'LC'].includes(inv.subtype ?? '')) {
    return 'fixed_income';
  }
  if (/^[A-Z]{4}11$/.test(inv.code ?? '')) return 'fii';
  if (/^[A-Z]{4}\d{1,2}$/.test(inv.code ?? '')) return 'stock';
  return 'fixed_income';
}
```

- If `inv.code` does not match a B3 pattern for a stock/FII, the position is stored with `ticker = null` for stocks/FIIs and excluded from the quote refresh loop. UI marks it with a "⚠ sem cotação" badge.
- Fixed income positions store `ticker` as a human-readable label (Pluggy `name`).

### Rate-limit budget (HG Brasil free tier)

- 400 requests/day shared.
- Realistic portfolio: ≤30 stock/FII positions.
- 1–2 refreshes/month × ~30 tickers ≈ 60 requests/month. Well within free tier.
- One HG endpoint call per ticker (free tier disallows multi-ticker batching).

### Idempotency

All writes use UPSERT by unique key. Re-running `/api/invest/refresh` on the same day produces no duplicate rows and yields the same final state given identical upstream data.

---

## 5. UI

### Route

`/invest`. Sidebar item inserted between Fluxo and Contas: `{ href: '/invest', label: 'Investimentos', icon: 'trending-up' }`. Icon added to `src/components/atoms/icon.tsx` if absent.

### Layout (`invest-shell.tsx`)

```
┌─────────────────────────────────────────────────┐
│ Investimentos       [Atualizar] [Última: 13/05] │
├─────────────────────────────────────────────────┤
│ ┌─KPI──┐ ┌─KPI──┐ ┌─KPI──┐ ┌─KPI──┐             │
│ │Patrim│ │Ações │ │ FIIs │ │  RF  │             │
│ │R$ X  │ │40% Y │ │30% Z │ │30% W │             │
│ │+/- % │ │+/-   │ │+/-   │ │+/-   │             │
│ └──────┘ └──────┘ └──────┘ └──────┘             │
├─────────────────────────────────────────────────┤
│ ┌──Pizza alocação──┐ ┌──Linha evolução────────┐ │
│ │     [donut]      │ │   /\   /\    /         │ │
│ └──────────────────┘ └────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ Posições                                        │
│ Ticker │ Qty │  PM  │ Cotação │  Valor  │  %    │
│ PETR4  │ 100 │30,12 │  38,40  │  3.840  │ 8,2   │
│ HGLG11 │  50 │160,5 │ 172,30  │  8.615  │18,0   │
└─────────────────────────────────────────────────┘
```

### Components

| File | Server/Client | Responsibility |
|---|---|---|
| `invest-shell.tsx` | client | Composes layout; passes data to children |
| `kpi-cards.tsx` | server | Total + 3 class cards; gain/loss coloured |
| `allocation-pie.tsx` | client | Chart.js donut; 3 slices |
| `evolution-line.tsx` | client | Chart.js line over last 12 snapshots |
| `positions-table.tsx` | server | Sortable by `current_value` DESC; subgrouped by class |
| `refresh-button.tsx` | client | POST `/api/invest/refresh`; toast feedback via `lib/toast.ts` |

### Computed values

- `gainLoss = currentValue - (quantity * avgPrice)` per position
- `% class = classValue / totalValue * 100`
- `% position = position.currentValue / totalValue * 100`
- Class colours: stocks = accent green, FIIs = blue, fixed income = grey (consistent with `src/app/globals.css`)

### Empty / degraded states

- Zero positions: centred card "Configure Pluggy + clique Atualizar".
- Fewer than 2 snapshots: line chart shows "Aguardando histórico (mín 2 snapshots)".
- Quote older than 7 days: badge "⚠ desatualizado" on that row.
- Position with `ticker = null`: badge "⚠ sem cotação"; excluded from quote refresh.

---

## 6. Error Handling

### Failure modes

| Failure | Module | Behaviour |
|---|---|---|
| Pluggy item offline / 401 | `pluggy-invest.ts` | Caught; recorded in `syncLog`; returned in `errors[]` |
| Pluggy returns 0 investments | `pluggy-invest.ts` | Silent; positions untouched; snapshot keeps prior values |
| HG Brasil 401 (invalid key) | `hg-client.ts` | Throws `HgAuthError` → API 500 + toast "Configure HG_BRASIL_KEY" |
| HG Brasil 429 (rate limit) | `hg-client.ts` | Throws `HgRateLimitError` → API 503 + toast "Limite diário atingido" |
| HG Brasil unknown ticker | `hg-client.ts` | Warning logged; previous cache value retained; `positions.last_quote` preserved |
| HG Brasil timeout / network | `hg-client.ts` | Retry once with 500 ms backoff; on failure preserve cached value |
| `ticker = null` on stock/FII | `quotes.ts` | Skip refresh; mark `last_quote_at = null` → UI badge "⚠ sem cotação" |
| DB constraint failure | `lib/*` | Throws; API 500 + log; no retry |
| Duplicate snapshot same date | `snapshot.ts` | Silent UPSERT (UNIQUE on `snapshot_date`) |
| Missing env (`PLUGGY_*`, `HG_BRASIL_KEY`) | startup check in `lib/invest/config.ts` | First API call returns 500 with explicit message naming the missing variable |

### Typed errors

```ts
export class HgAuthError extends Error {}
export class HgRateLimitError extends Error {}
export class PluggyItemError extends Error {
  constructor(public itemId: string, msg: string) { super(msg); }
}
```

### API response shape

`POST /api/invest/refresh` success:

```json
{
  "ok": true,
  "syncedPositions": 12,
  "refreshedQuotes": 9,
  "skippedQuotes": 1,
  "snapshotDate": "2026-05-13",
  "warnings": ["ticker XYZ4 não encontrado HG", "Pluggy item abc: timeout"]
}
```

Hard errors (auth, rate limit): HTTP 4xx/5xx + `{ ok: false, error, code }`.

### Logging

Reuses the existing `syncLog` table (already used by Pluggy cash-flow sync). The `status` column accepts `'ok' | 'error'`. A `kind = 'invest_refresh'` column is optional and deferred to sub-project #2 if needed.

### UI feedback

`lib/toast.ts` (existing): green = success, amber = warning, red = error. The refresh button is disabled during the request and shows a spinner.

### Principle

No partial failure corrupts state. Refresh is all-or-nothing per section: if Pluggy succeeds and HG fails, the snapshot is still written using the most recent cached quotes.

---

## 7. Testing Strategy

### Tooling

Vitest (already in `package.json`). Test files colocated next to source as `*.test.ts` and `*.integration.test.ts`.

### Pyramid

| Level | Target | Files | Coverage focus |
|---|---|---|---|
| Unit (pure) | Pure domain functions | `lib/invest/*.test.ts` | Formulas, classifiers, aggregations |
| Integration | DB + lib (Drizzle + in-memory SQLite) | `lib/invest/*.integration.test.ts` | Upserts, snapshots, queries |
| API | Route handlers with mocked Pluggy/HG | `app/api/invest/*/route.test.ts` | Happy path + 2-3 error paths |
| UI | Smoke render | — | Deferred post-MVP |

### Critical unit cases (TDD: red → green → refactor)

```
positions.ts
  ✓ classifyAsset: 'PETR4' → 'stock'
  ✓ classifyAsset: 'HGLG11' → 'fii' (suffix 11)
  ✓ classifyAsset: 'CDB 100% CDI' → 'fixed_income'
  ✓ classifyAsset: code null + type FIXED_INCOME → 'fixed_income'
  ✓ classifyAsset: malformed code → 'fixed_income' (fallback)
  ✓ computePositionValue: stock = qty * lastQuote
  ✓ computePositionValue: fixed income = Pluggy balance
  ✓ computePositionValue: stock without quote → previous cached lastQuote
  ✓ computeGainLoss: positive, negative, zero

snapshot.ts
  ✓ aggregateByClass: correct sum per class
  ✓ aggregateByClass: empty class returns 0
  ✓ persistToday: inserts new day
  ✓ persistToday: upserts same day (no duplicate)
  ✓ totalCost = sum(quantity * avgPrice)

quotes.ts
  ✓ refresh: collects unique tickers from positions
  ✓ refresh: skips null ticker
  ✓ refresh: skips asset_class = 'fixed_income'
  ✓ TTL stale > 24 h triggers fetch
  ✓ HG error: preserves previous positions.lastQuote

hg-client.ts
  ✓ parseResponse: extracts price + changePercent
  ✓ parseResponse: ticker not found → null
  ✓ status 401 → HgAuthError
  ✓ status 429 → HgRateLimitError
  ✓ timeout → retry once → final error
```

### Mocks

- `pluggy-sdk`: `vi.mock('pluggy-sdk')` with JSON fixtures in `src/lib/invest/__fixtures__/`.
- HG Brasil: `vi.fn()` wrapping `fetch`; no real HTTP in tests.

### Fixtures (`src/lib/invest/__fixtures__/`)

- `pluggy-invest-stocks.json` — typical stock/FII positions (PETR4, VALE3, HGLG11)
- `pluggy-invest-fixed.json` — CDB, LCI, Tesouro
- `hg-stock-petr4.json` — valid HG quote response
- `hg-ticker-not-found.json` — HG no-match response

### Pre-merge gates

1. `npm run test:run` — all green
2. `npm run build` — TypeScript clean
3. Manual smoke test: `/invest` loads; "Atualizar" runs without crash against real envs

### TDD discipline

Follows `superpowers:test-driven-development`. Each new function begins with a failing test.

---

## 8. Environment

Required `.env.local` entries (additions on top of existing):

```
PLUGGY_CLIENT_ID=...           # existing
PLUGGY_CLIENT_SECRET=...       # existing
PLUGGY_ITEM_IDS=...            # existing; broker item must be among these
HG_BRASIL_KEY=...              # NEW: free key from https://hgbrasil.com/status/finance
```

`lib/invest/config.ts` validates presence on first API call and throws with an explicit message if any are missing.

---

## 9. Out-of-scope Risks (acknowledged)

- **Pluggy broker connector availability:** if the user's broker has no Pluggy connector, no positions will sync. Mitigation: manual entry remains feasible (the `pluggy_id` column is nullable), but UI for manual entry is not in MVP1.
- **HG ticker coverage gaps:** rare tickers may be absent from HG. Mitigation: row badge + last cached value; user can investigate manually.
- **Free HG endpoint shape changes:** breaking change in HG response would require updating `hg-client.ts` parser only.

---

## 10. Next Steps

1. User reviews this spec.
2. On approval, invoke `superpowers:writing-plans` to produce an implementation plan with concrete TDD-ordered steps.
3. Execute the plan on branch `feat/invest-core`.
4. After merge, open spec for sub-project #2 (`invest-dividends`).
