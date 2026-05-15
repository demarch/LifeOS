# Budgets — Design Spec

**Date:** 2026-05-14
**Branch target:** `feat/budgets`
**Status:** Draft for review
**Related:** Roadmap item "Budgets — Set monthly limits per category with progress tracking"

---

## 1. Goal

Add category-based monthly budgets that integrate tightly with the existing `/fluxo` (cash flow) page. The user sets a monthly spending ceiling per category; the app shows live progress bars that combine real transactions (already imported via Pluggy) with planned future cash-flow entries — without double-counting.

## 2. Non-goals

- Annual or weekly budget periods (monthly only — matches `/fluxo` identity).
- Income forecasting (`/fluxo` plan-vs-real already covers this; income budgets in scope but as a parallel section, not replacement).
- Budget *forecasting* beyond next month's carry-in (no multi-month projection).
- Multi-currency (BRL only).
- Mobile-specific UX.
- Push/browser notifications (separate roadmap item).

## 3. Decisions (resolved during brainstorming)

| # | Question | Decision |
|---|----------|----------|
| 1 | Integration surface | Sidebar category lane inside `/fluxo` (plus a dedicated `/orcamento` config page) |
| 2 | What feeds the bars | Full feature — categories become first-class entities; `cashFlowEntries` gets `categoryId`; real side reads `transactions.category` mapped via alias table |
| 3 | Category seed | Curated BR list (~10 categories with icon + color) + fuzzy auto-bind of existing bill/sub/tx strings |
| 4 | Reconciliation | Hybrid — bills/subs use `sourceRefId` heuristic match (±5d, ±10%); manual entries use time-based switchover (past → drop planned, future → keep) |
| 5 | Income side | Both receitas and despesas budgeted, separate sidebar sections |
| 6 | Carryover | Per-category toggle, surplus rolls forward (deficit reduces, floored at 0) |
| 7 | Alerts | Layered — bar color tiers (green/yellow/red), one-shot toast on threshold cross during `/fluxo` edit, dashboard banner listing over-budget categories |
| 8 | Period | Monthly only |
| 9 | Build sequence | 4 vertical slices, each shippable independently |

## 4. Architecture

### 4.1 Schema

**New tables**

```sql
budget_categories
  id          text PK
  name        text NOT NULL UNIQUE       -- "Moradia", "Mercado"
  kind        text NOT NULL              -- 'expense' | 'income'
  color       text NOT NULL              -- "#a78bfa"
  icon        text NOT NULL              -- emoji or lucide name
  carryover   integer NOT NULL DEFAULT 0
  sortOrder   integer NOT NULL DEFAULT 0
  isArchived  integer NOT NULL DEFAULT 0
  createdAt   integer NOT NULL

budget_limits                            -- per-month limit override
  id          text PK
  categoryId  text NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE
  monthKey    text NOT NULL              -- "2026-05"
  amount      real NOT NULL              -- monthly limit in BRL
  createdAt   integer NOT NULL
  UNIQUE(categoryId, monthKey)
```

**Altered**

```sql
cashFlowEntries
  + categoryId text REFERENCES budget_categories(id)  -- nullable
```

`transactions.category` (existing free-text) and `bills.category` / `subscriptions.category` stay unchanged. They keep storing free-text strings; mapping to `budget_categories` happens at read time via `resolveCategoryId()`. No FK is added to those legacy fields because their free-text values must keep working when a referenced `budget_category` is renamed or archived.

### 4.2 Module layout

```
src/lib/budgets.ts             # compute, reconcile, resolveCategoryId
src/lib/budget-seed.ts         # curated seed + fuzzy bind migration
src/app/orcamento/page.tsx     # config page (SSR)
src/app/api/budgets/           # categories + limits CRUD endpoints
src/components/pages/
  fluxo/budget-lane.tsx        # sidebar widget (NEW)
  fluxo/budget-bar.tsx         # single split-fill bar (NEW)
  orcamento/                   # category list, limit editor (NEW)
  home/budget-banner.tsx       # dashboard alert strip (NEW)
scripts/migrate-budgets.ts     # one-shot migration runner
```

### 4.3 Compute pipeline (per category, per month)

```
limit         = budget_limits[catId][monthKey]
                ?? lastKnown(catId)             -- most recent budget_limits row
                                                 -- for catId with monthKey < currentMonthKey
                ?? 0
carryIn       = if category.carryover: max(0, prev_month.surplus)
                else 0
realSpent     = Σ tx.amount  where resolveCategoryId(tx.category)=catId AND date in monthKey
plannedFuture = Σ entry.saida where entry.categoryId=catId
                AND entry not matched to a real tx
                AND (entry.source ∈ {bill,subscription} OR entry.date >= today)
total         = realSpent + plannedFuture
pct           = total / (limit + carryIn)
status        = pct < 0.8 → 'ok' | < 1.0 → 'warning' | >= 1.0 → 'over'
```

### 4.4 Source-of-truth model

- `budget_categories` — canonical taxonomy
- `cashFlowEntries.categoryId` — planned spend binding (nullable for legacy)
- `transactions.category` (free text) — real spend signal, resolved on read
- No materialized aggregation table — compute on read (mirrors `monthSummary`)

## 5. Slices

### Slice 1 — Schema + migration (DB-only)

**Files**
- `src/db/schema.ts` (ALTER)
- `src/lib/budget-seed.ts` (NEW)
- `scripts/migrate-budgets.ts` (NEW)
- `src/__tests__/budget-seed.test.ts` (NEW)

**Migration steps**
1. `db:push` adds tables/column
2. Insert curated seed (idempotent on name)
3. `SELECT DISTINCT category FROM bills`, `subscriptions`
4. Fuzzy-match each to seed via accent-stripped lowercase + alias map from `lib/auto-detect.ts` KEYWORDS
5. Update `cashFlowEntries.categoryId` where `sourceRefId` references a bound bill/sub
6. Unmatched → `Outros` or null (logged for review)
7. Wrap in transaction; backup `cashFlowEntries` to `cashFlowEntries_backup_<ts>` before mass UPDATE

**Curated seed**

```
Moradia       🏠 #a78bfa   expense
Mercado       🛒 #34d399   expense
Transporte    🚗 #fbbf24   expense
Lazer         🎬 #f87171   expense
Saúde         ⚕️  #60a5fa   expense
Educação      📚 #f472b6   expense
Assinaturas   📺 #818cf8   expense
Trabalho      💼 #14b8a6   expense
Investimentos 📈 #22d3ee   expense
Outros        ⚪ #9ca3af   expense
Salário       💰 #34d399   income
Outros (rec.) ⚪ #9ca3af   income
```

### Slice 2 — `/orcamento` config page

**Files**
- `src/app/orcamento/page.tsx` (NEW, SSR)
- `src/components/pages/orcamento/budget-shell.tsx` (NEW, client)
- `src/components/pages/orcamento/category-list.tsx` (NEW)
- `src/components/pages/orcamento/category-form-dialog.tsx` (NEW)
- `src/components/pages/orcamento/copy-limits-dialog.tsx` (NEW)
- `src/app/api/budgets/categories/route.ts` (NEW — GET, POST)
- `src/app/api/budgets/categories/[id]/route.ts` (NEW — PATCH, DELETE)
- `src/app/api/budgets/limits/route.ts` (NEW — GET by monthKey, POST upsert)
- `src/app/api/budgets/limits/copy/route.ts` (NEW — bulk copy from prev month)

**UX**
- Single table view: icon, name, kind, color, monthly limit input (inline edit), carryover toggle, archive button
- "+ Nova categoria" dialog
- "Copiar limites do mês anterior" action
- Tabs: Despesas | Receitas | Arquivadas

### Slice 3 — `/fluxo` sidebar lane (read-only first)

**Files**
- `src/lib/budgets.ts` (NEW — `computeBudgetMonth`, `resolveCategoryId`)
- `src/components/pages/fluxo/budget-lane.tsx` (NEW)
- `src/components/pages/fluxo/budget-bar.tsx` (NEW)
- `src/app/fluxo/page.tsx` (ALTER — compute + pass budgets)
- `src/components/pages/fluxo/cash-flow-shell.tsx` (ALTER — split-pane layout)
- `src/components/pages/fluxo/entries-table.tsx` (ALTER — `+ categoria` column with chip dropdown)
- `src/app/api/cashflow/entries/[id]/route.ts` (ALTER — accept `categoryId` on PATCH)

**Layout**
- `/fluxo` becomes flex: table on left (flex:1), `BudgetLane` ~140px sidebar on right
- Sidebar split: Despesas (top) + Receitas (bottom)
- Each bar: icon, name, "spent/limit", split-fill bar (real solid + planned hatched)
- Graceful degradation: if zero categories defined or compute fails, sidebar renders an empty-state with a link to `/orcamento`; entries-table layout unchanged when sidebar is empty

### Slice 4 — Reconciliation + alerts

**Files**
- `src/lib/budgets.ts` (EXTEND — `matchBillSubEntries`, `classifyManualEntry`, `computeCarryIn`)
- `src/components/pages/fluxo/budget-bar.tsx` (ALTER — color tiers)
- `src/components/pages/fluxo/cash-flow-shell.tsx` (ALTER — one-shot threshold toast)
- `src/components/pages/home/budget-banner.tsx` (NEW)
- `src/app/page.tsx` (ALTER — render banner)

## 6. Type contracts

```ts
// src/lib/budgets.ts
export interface BudgetRow {
  catId: string;
  name: string;
  color: string;
  icon: string;
  kind: 'expense' | 'income';
  limit: number;          // effective for monthKey
  carryIn: number;        // 0 if carryover off or first month
  realSpent: number;      // sum of resolved real tx
  plannedFuture: number;  // sum of unmatched/future planned entries
  total: number;          // realSpent + plannedFuture
  pct: number;            // total / (limit + carryIn)
  status: 'ok' | 'warning' | 'over';
}

export interface BudgetMonth {
  monthKey: string;
  expense: BudgetRow[];
  income: BudgetRow[];
}

export function computeBudgetMonth(monthKey: string): BudgetMonth;
export function resolveCategoryId(rawCategory: string): string | null;
```

## 7. Reconciliation rules

### Bills/subs (sourceRefId path)

For each `cashFlowEntry` with `source ∈ {bill, subscription}`:
- Find first `transaction` where:
  - `amount < 0` (expense), `type !== 'transfer'`
  - `|date - entry.date| ≤ 5 days`
  - `||amount| - entry.saida| / entry.saida ≤ 0.10`
- If found → entry is "matched"; excluded from `plannedFuture`; tx counts toward `realSpent` via category resolution
- If not found → entry stays in `plannedFuture` (treat as forecast)

### Manual entries (time-switchover)

- `entry.date < today` → drop from `plannedFuture` (assume real tx covers that date)
- `entry.date >= today` → keep in `plannedFuture`

### resolveCategoryId

```
NORMALIZE(s) = lowercase + NFD-strip-accents + trim
CATEGORY_ALIASES built at startup from:
  1. budget_categories.name (canonical)
  2. KEYWORDS from lib/auto-detect.ts (e.g. "netflix" → Assinaturas)
Cache invalidated on category mutation.
Unknown → "Outros" (curated).
```

### Carryover

```
prev = prevMonthKey(monthKey)
for each carryover-enabled category:
  prevRow = computeBudgetMonth(prev).expense.find(...)
  surplus = (prevRow.limit + prevRow.carryIn) - prevRow.total
  carryIn[catId] = max(0, surplus)  // never negative-display
```

Recursion bound: one prev-month lookup per compute call.

## 8. API contracts

```
GET    /api/budgets/categories               → BudgetCategory[]
POST   /api/budgets/categories               { name, kind, color, icon, carryover, sortOrder }
PATCH  /api/budgets/categories/[id]          partial
DELETE /api/budgets/categories/[id]          → 409 if any cashFlowEntry.categoryId references it

GET    /api/budgets/limits?monthKey=YYYY-MM  → BudgetLimit[]
POST   /api/budgets/limits                   upsert { categoryId, monthKey, amount }
POST   /api/budgets/limits/copy              { fromMonthKey, toMonthKey }

GET    /api/budgets/month?monthKey=YYYY-MM   → BudgetMonth

POST   /api/budgets/seed                     idempotent
POST   /api/budgets/bind-legacy              one-shot fuzzy bind
```

### Validation

| Field | Rule | Error |
|-------|------|-------|
| `category.name` | non-empty, unique (case-insensitive) | 400 `"Nome já existe"` |
| `category.kind` | enum `'expense' \| 'income'` | 400 |
| `category.color` | `/^#[0-9a-f]{6}$/i` | 400 |
| `category.icon` | non-empty | 400 |
| `limit.amount` | finite, ≥ 0 | 400 |
| `limit.monthKey` | `/^\d{4}-\d{2}$/` | 400 |
| DELETE with refs | check `cashFlowEntries.categoryId` | 409 `{error, refs}` |

## 9. Error handling

- SSR compute wrapped in try/catch — sidebar renders "Orçamento indisponível" on failure; `/fluxo` never blocks
- Optimistic mutations (reuse `cash-flow-shell.tsx` pattern): set local → fetch → on fail revert + toast
- 409 on category delete → modal: "X lançamentos usam esta categoria. Arquivar ou reatribuir?"
- Threshold-toast deduped per session per category to avoid spam during bulk edit; reset on month change

## 10. Edge cases

| Case | Behavior |
|------|----------|
| Tx with no category | Falls into Outros |
| Entry with no categoryId | Excluded from budget bars (still in `/fluxo` total) |
| Bill/sub category renamed mid-month | Rebind on save; existing entries unchanged until manual recategorize |
| Tx amount > entry.saida by > 10% | No match → tx counted as real, entry counted as planned (double counts; user reconciles manually) |
| Multiple tx match one entry | First match wins; rest count as real |
| Month with no budget_limits row | Falls back to lastKnown; if none → 0, status ok |
| Category archived | Hidden from sidebar; historical entries keep categoryId; visible under Arquivadas tab |
| Carryover negative (deficit) | Reduces effective limit; carryIn floored at 0 for display |

## 11. Testing strategy

### Unit (Vitest, mirror existing patterns)

- `src/__tests__/budget-seed.test.ts` — curated seed idempotency, fuzzy bind, accent normalization
- `src/__tests__/budgets-compute.test.ts` — `computeBudgetMonth` across past/future/mixed scenarios, status thresholds, `resolveCategoryId` aliases
- `src/__tests__/budgets-reconcile.test.ts` — bill/sub match heuristic, manual time-switchover, carryover surplus/deficit math

### API integration (in-memory SQLite via better-sqlite3 `:memory:`)

- `src/__tests__/budgets-api.test.ts` — categories CRUD (incl. 409 on delete with refs), limits upsert, limits copy. Uses a fresh in-memory DB per test; no production DB hit. If repo lacks the integration harness, scope this to unit-level coverage of the route handler functions instead.

### Manual smoke per slice

| Slice | Check |
|-------|-------|
| 1 | Run `scripts/migrate-budgets.ts` → curated cats present, legacy entries bound, unmatched logged |
| 2 | `/orcamento` → add cat → set limit → reload → persists |
| 3 | `/fluxo` → sidebar shows bars → edit entry category → bar updates live |
| 4 | Push category over → toast fires once; reload → bar red, dashboard banner shows |

### Fixtures

`src/__tests__/fixtures/budget-fixtures.ts` — curated cats, sample entries (mix bill/sub/manual), sample tx (mix categorized/uncategorized).

### Regression

`autoSeedPlan` in `lib/cashflow.ts` extended to populate `categoryId` from bill/sub via `resolveCategoryId`. Existing tests must continue to pass.

## 12. Open items (deferred, not blockers)

- Bulk "recategorize" tool for past entries — wait until users actually need it
- Drag-drop reordering of categories — sortOrder is in schema, UI can come later
- Annual-bucket categories (IPVA, IPTU) — defer until requested; users hack via monthly allocation
- Push notifications for threshold cross — separate roadmap item

## 13. Out of scope

Anything not listed under Slices 1-4. No multi-currency, no weekly/annual periods, no income forecasting redesign, no mobile-specific UX, no external sharing/export of budgets.

---

## Sign-off checklist

- [x] All Q&A decisions captured
- [x] 4 slice boundaries clear
- [x] Schema delta complete
- [x] Public lib API typed
- [x] Edge cases enumerated
- [x] Test plan covers every new module
- [ ] User review (pending)
