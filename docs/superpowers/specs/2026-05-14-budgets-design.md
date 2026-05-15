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
  name        text NOT NULL UNIQUE COLLATE NOCASE  -- "Moradia", "Mercado"; case-insensitive
  kind        text NOT NULL                        -- 'expense' | 'income'
  color       text NOT NULL                        -- "#a78bfa"
  icon        text NOT NULL                        -- emoji or lucide name
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
  + categoryId text REFERENCES budget_categories(id) ON DELETE NO ACTION  -- nullable; RESTRICT semantics with FKs on
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

Pure function over explicit inputs: `{categories, limits, entries, transactions, prevMonth?, today?}`. No DB reads inside compute — SSR layer loads the data.

**Common (both kinds)**

```
limit          = limits[catId][monthKey]
                 ?? lastKnownPrevMonth(catId, monthKey)  -- only the IMMEDIATELY prior monthKey
                 ?? 0
carryIn        = if category.carryover && prevMonth: max(0, prevMonth.surplus(catId))
                 else 0
                 -- prevMonth itself must be computed with carryIn=0 (depth cap = 1)
```

**Expense rules (kind === 'expense')**

```
realSpent      = Σ |tx.amount| where effectiveCategoryId(tx, matchedEntry?) = catId
                 AND tx.amount < 0 AND tx.type !== 'transfer'
                 AND tx.date in monthKey
plannedFuture  = Σ entry.saida where entry.categoryId = catId
                 AND entry NOT matched to a real tx (per §7)
                 AND (entry.source ∈ {bill,subscription} OR entry.date >= today)
total          = realSpent + plannedFuture
pct            = total / max(1, limit + carryIn)
status         = pct < 0.8 → 'ok' | < 1.0 → 'warning' | >= 1.0 → 'over'
surplus(catId) = (limit + carryIn) - total          -- can be negative; carryIn clamps later
```

**Income rules (kind === 'income')**

```
realReceived   = Σ tx.amount where effectiveCategoryId(tx, matchedEntry?) = catId
                 AND tx.amount > 0 AND tx.type !== 'transfer'
                 AND tx.date in monthKey
plannedFuture  = Σ entry.entrada where entry.categoryId = catId
                 AND entry NOT matched to a real tx
                 AND entry.date >= today
total          = realReceived + plannedFuture
pct            = total / max(1, limit + carryIn)            -- limit here = target income
status         = pct < 0.8 → 'over' (under target, BAD)
               | < 1.0 → 'warning'
               | >= 1.0 → 'ok' (hit/exceeded target, GOOD)
                 -- thresholds inverted; bar color tiers in Slice 4 honor this
surplus        = N/A for income (no carryover for receitas in v1)
```

**effectiveCategoryId**

```
effectiveCategoryId(tx, matchedEntry?) =
  matchedEntry?.categoryId                  -- inherit from planned entry when matched (§7)
  ?? resolveCategoryId(tx.category)
  ?? resolveCategoryId(tx.description)      -- fallback: KEYWORDS pass on description
  ?? 'Outros'
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
2. Insert curated seed (idempotent on name, case-insensitive via `COLLATE NOCASE`)
3. `SELECT DISTINCT category FROM subscriptions` — primary signal. **Note:** `bills.category` is overwhelmingly `'Outros'` in practice (`pluggy.ts:224`, `bills-list.tsx:51,57` default to `'Outros'`); distinct-category step on `bills` produces near-zero useful bindings — skip or treat as low-yield
4. Fuzzy-match each via accent-stripped lowercase + `KEYWORD_CATEGORY_MAP` (below) layered over `KEYWORDS` from `lib/auto-detect.ts`
5. Update `cashFlowEntries.categoryId` where `sourceRefId` references a bound bill/sub
6. Unmatched → `Outros` or null (logged for review)
7. Wrap in transaction; backup `cashFlowEntries` to `cashFlowEntries_backup_<ts>` before mass UPDATE
8. Script imports `seedCuratedCategories()` and `bindLegacyCategories()` from `src/lib/budget-seed.ts` — same helpers used by `/api/budgets/seed` and `/api/budgets/bind-legacy` (single source of truth, see §8)

**KEYWORD_CATEGORY_MAP** — bridges `auto-detect.ts` KEYWORDS output to curated taxonomy

```ts
// auto-detect.ts produces { name, category } where category ∈ {Streaming, IA, Outros, ...}
// Curated taxonomy uses {Assinaturas, Moradia, Mercado, ...}
// This map closes the gap so Netflix → Streaming → Assinaturas (not Outros).
export const KEYWORD_CATEGORY_MAP: Record<string, string> = {
  Streaming:   'Assinaturas',
  IA:          'Assinaturas',
  Outros:      'Outros',
  // Extend as new KEYWORDS categories appear.
};
```

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
  carryIn: number;        // 0 if carryover off, depth>1, or first month
  realSpent: number;      // expense: |neg tx|; income: pos tx (named realReceived in §4.3)
  plannedFuture: number;  // unmatched/future planned entries
  total: number;          // realSpent + plannedFuture
  pct: number;            // total / max(1, limit + carryIn)
  status: 'ok' | 'warning' | 'over';  // thresholds inverted for income (§4.3)
}

export interface BudgetMonth {
  monthKey: string;
  expense: BudgetRow[];
  income: BudgetRow[];
}

export interface ComputeBudgetInput {
  categories: BudgetCategory[];
  limits: BudgetLimit[];
  entries: CashFlowEntry[];
  transactions: Transaction[];
  prevMonth?: BudgetMonth;   // depth-1 cap: passed in by caller, never recursed inside compute
  today?: Date;              // defaults to new Date(); injectable for tests
}

// Pure function — no DB reads. SSR/API layer loads inputs.
export function computeBudgetMonth(monthKey: string, data: ComputeBudgetInput): BudgetMonth;

export function resolveCategoryId(rawCategory: string): string | null;

// Used inside computeBudgetMonth; exported for unit tests.
export function effectiveCategoryId(
  tx: Transaction,
  matchedEntry?: CashFlowEntry,
): string | null;
```

## 7. Reconciliation rules

### Bills/subs (sourceRefId path)

For each `cashFlowEntry` with `source ∈ {bill, subscription}`:
- Find first `transaction` where:
  - `amount < 0` (expense), `type !== 'transfer'`
  - `|date - entry.date| ≤ 5 days`
  - `||amount| - entry.saida| / entry.saida ≤ 0.10`
- If found → entry is "matched"; excluded from `plannedFuture`; tx counts toward `realSpent` under the **inherited category**:
  - `effectiveCategoryId(tx, matchedEntry) = matchedEntry.categoryId ?? resolveCategoryId(tx.category) ?? resolveCategoryId(tx.description) ?? 'Outros'`
  - **Why:** an entry tagged `Moradia` paired with a bank tx whose `category` is blank must still land on the `Moradia` bar; without inheritance, the spend silently drops into `Outros` and the user can't see why
- If not found → entry stays in `plannedFuture` (treat as forecast)

### Manual entries (time-switchover)

- `entry.date < today` → drop from `plannedFuture` (assume real tx covers that date)
- `entry.date >= today` → keep in `plannedFuture`

### resolveCategoryId

Two-pass lookup. The first pass hits curated names directly; the second runs the input through `auto-detect.ts` KEYWORDS, then translates via `KEYWORD_CATEGORY_MAP` (defined in §5 Slice 1).

```
NORMALIZE(s) = lowercase + NFD-strip-accents + trim

Pass 1 — direct curated lookup
  ALIAS_TABLE: Map<normalized_name, catId>
    built at startup from budget_categories (canonical names)
    cache invalidated on category mutation
  hit → return catId

Pass 2 — KEYWORDS-bridged lookup
  detect = auto-detect.ts detectFromText(input)
    → { name, category }   // e.g. "NETFLIX.COM" → {name:'Netflix', category:'Streaming'}
  curated = KEYWORD_CATEGORY_MAP[detect.category]
    → "Streaming" → "Assinaturas"
  hit → return ALIAS_TABLE[NORMALIZE(curated)]

Default → "Outros" (curated)
```

**Worked examples**

| Input source | Value | Pass 1 hit? | Pass 2 | Final |
|---|---|---|---|---|
| `tx.category` | `'Assinaturas'` | yes | — | `Assinaturas` |
| `tx.category` | `'Streaming'` | no | `Streaming → Assinaturas` | `Assinaturas` |
| `tx.description` | `'NETFLIX.COM 12/12'` | no (passed via tx.category=''; fallback to description in `effectiveCategoryId`) | KEYWORDS → `Streaming` → `Assinaturas` | `Assinaturas` |
| `tx.category` | `''` and description `'PADARIA PAO QUENTE'` | no | KEYWORDS no hit | `Outros` |

### Carryover

Depth capped at 1. Caller computes `prevMonth` once (with `carryIn=0` inside its own compute) and passes it in via `ComputeBudgetInput.prevMonth`. The compute function never recurses.

```
// Caller (SSR / API):
const prevMonth = computeBudgetMonth(prevMonthKey(monthKey), {
  ...inputsForPrev,
  prevMonth: undefined,     // depth-1 cap: prev's prev is NOT walked
});
const month = computeBudgetMonth(monthKey, { ...inputs, prevMonth });

// Inside compute, per carryover-enabled category:
const prevRow = prevMonth?.expense.find(r => r.catId === cat.id);
const surplus = prevRow ? (prevRow.limit + prevRow.carryIn) - prevRow.total : 0;
carryIn[catId] = Math.max(0, surplus);   // deficit → 0; never negative-display
```

**Trade-off acknowledged:** capping at depth 1 means a long-running surplus from many months ago does not propagate forward. Acceptable for v1 — keeps compute deterministic and cheap on every `/fluxo` SSR render.

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
| `category.name` | non-empty, unique case-insensitive (enforced by `UNIQUE ... COLLATE NOCASE` in §4.1; route also normalizes for friendlier error) | 400 `"Nome já existe"` |
| `category.kind` | enum `'expense' \| 'income'` | 400 |
| `category.color` | `/^#[0-9a-f]{6}$/i` | 400 |
| `category.icon` | non-empty | 400 |
| `limit.amount` | finite, ≥ 0 | 400 |
| `limit.monthKey` | `/^\d{4}-\d{2}$/` | 400 |
| DELETE with refs | check `cashFlowEntries.categoryId` (FK is `ON DELETE NO ACTION`; route surfaces 409 before SQLite raises) | 409 `{error, refs}` |

### Seed / bind-legacy / migration script — division of labor

Single source of truth for seeding and fuzzy binding logic: `src/lib/budget-seed.ts`. Three callers:

| Caller | Purpose | Helpers used |
|---|---|---|
| `POST /api/budgets/seed` | Idempotent runtime path. Safe to call from UI bootstrap. | `seedCuratedCategories()` |
| `POST /api/budgets/bind-legacy` | One-shot runtime path. Triggered from `/orcamento` admin action. | `bindLegacyCategories()` |
| `scripts/migrate-budgets.ts` | One-shot CLI path (CI / first deploy). Same helpers; adds backup table and transaction wrapper around the mass `UPDATE cashFlowEntries`. | `seedCuratedCategories()`, `bindLegacyCategories()` |

Rule: no fuzzy-bind logic outside `budget-seed.ts`. The two API routes and the script differ only in transport (HTTP vs CLI) and the script's pre-update backup step.

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
| Month with no budget_limits row | `lastKnownPrevMonth` falls back **only to the immediately prior monthKey** (not arbitrarily far back) — avoids a one-off ago/2026 limit silently persisting forever. If the prev month has no row either → `limit = 0`, status `ok`. Future enhancement: surface a "limite herdado de YYYY-MM" badge in bar tooltip if/when fallback is broadened |
| Category archived | Hidden from sidebar; historical entries keep categoryId; visible under Arquivadas tab |
| Carryover negative (deficit) | Reduces effective limit; carryIn floored at 0 for display |

## 11. Testing strategy

### Unit (Vitest, mirror existing patterns)

- `src/__tests__/budget-seed.test.ts` — curated seed idempotency, fuzzy bind, accent normalization, `KEYWORD_CATEGORY_MAP` (Netflix → Streaming → Assinaturas, **not** Outros)
- `src/__tests__/budgets-compute.test.ts` — `computeBudgetMonth` across past/future/mixed scenarios, status thresholds (expense vs. income inversion), `resolveCategoryId` two-pass aliases, `effectiveCategoryId` matched-entry inheritance (entry.categoryId=Moradia + tx.category='' → Moradia, not Outros)
- `src/__tests__/budgets-reconcile.test.ts` — bill/sub match heuristic, manual time-switchover, carryover surplus/deficit math, **depth-1 cap** (month N-2 surplus does NOT reach month N)

### API integration (in-memory SQLite via better-sqlite3 `:memory:`)

- `src/__tests__/budgets-api.test.ts` — categories CRUD (incl. 409 on delete with refs), limits upsert, limits copy. Reuses the existing `:memory:` harness pattern already proven in `src/__tests__/cashflow-api.test.ts`; fresh DB per test, no production DB hit.
- **Prerequisite:** regenerate `src/__tests__/fixtures/schema.sql` to include `budget_categories`, `budget_limits`, and the new `cashFlowEntries.categoryId` column. Existing tests will break until the fixture is updated.

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

`autoSeedPlan` in `lib/cashflow.ts` extended to populate `categoryId` from bill/sub. **Resolution order** for the seeded entries: (1) bill/sub `name` via `resolveCategoryId` (KEYWORDS-bridged), (2) bill/sub `category` field, (3) `'Outros'`. Name-first because `bills.category='Outros'` is the prevailing reality (§5 Slice 1) — using `category` first would land every Netflix subscription in `Outros`. Existing tests must continue to pass.

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
