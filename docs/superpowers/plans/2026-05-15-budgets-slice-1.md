# Budgets Slice 1 — Schema + Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the DB-only foundation for category budgets: two new tables (`budget_categories`, `budget_limits`), one new column (`cash_flow_entries.category_id`), curated seed + fuzzy bind helpers, and a CLI migration runner. No UI yet.

**Architecture:** Drizzle schema declared in `src/db/schema.ts`; pushed via `drizzle-kit push`. Seed + bind logic lives in one shared module (`src/lib/budget-seed.ts`) that the runtime API routes (Slice 2) and the CLI migration script both call. Test harness mirrors `cashflow-api.test.ts` — `:memory:` SQLite seeded from `src/__tests__/fixtures/schema.sql`. Case-insensitive uniqueness on `budget_categories.name` enforced via a `COLLATE NOCASE` unique index (drizzle `sql\`... COLLATE NOCASE\`` expression). `cash_flow_entries.category_id` FK uses SQLite default `ON DELETE NO ACTION` — RESTRICT semantics when `PRAGMA foreign_keys = ON`.

**Tech Stack:** TypeScript, Drizzle ORM 0.31, better-sqlite3 12, drizzle-kit 0.22 (`db:push`), Vitest 1.6.

**Branch:** `feat/budgets` (already checked out).

**Spec ref:** `docs/superpowers/specs/2026-05-14-budgets-design.md` §4.1, §5 Slice 1, §11 (testing + fixture regen prerequisite).

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `src/db/schema.ts` | MODIFY | Add `budgetCategories`, `budgetLimits` tables + `categoryId` column on `cashFlowEntries`; export inferred types. |
| `src/__tests__/fixtures/schema.sql` | MODIFY | Mirror schema changes so `:memory:` test DB matches production. |
| `src/lib/budget-seed.ts` | CREATE | `CURATED_SEED`, `KEYWORD_CATEGORY_MAP`, `seedCuratedCategories()`, `resolveCategoryId()` factory, `bindLegacyCategories()`. Single source of truth for Slice 2's API routes and the CLI script. |
| `src/__tests__/budget-seed.test.ts` | CREATE | Vitest suite covering seed idempotency, resolver two-pass, fuzzy bind. |
| `scripts/migrate-budgets.ts` | CREATE | One-shot CLI: backup table → seed → bind-legacy → log unmatched. Wraps mutating work in a transaction. |

---

## Task 1: Drizzle schema delta

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add `budgetCategories` table after the existing `subscriptions` table (after line 51)**

```ts
import { sql } from 'drizzle-orm';
```

(Add this import to the existing imports at line 1 if not already present.)

Then insert after line 51:

```ts
export const budgetCategories = sqliteTable('budget_categories', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull(),
  kind:       text('kind').notNull(),         // 'expense' | 'income'
  color:      text('color').notNull(),
  icon:       text('icon').notNull(),
  carryover:  integer('carryover').notNull().default(0),
  sortOrder:  integer('sort_order').notNull().default(0),
  isArchived: integer('is_archived').notNull().default(0),
  createdAt:  integer('created_at').notNull(),
}, t => ({
  nameUnique: uniqueIndex('budget_categories_name_unique').on(sql`${t.name} COLLATE NOCASE`),
}));

export const budgetLimits = sqliteTable('budget_limits', {
  id:         text('id').primaryKey(),
  categoryId: text('category_id').notNull().references(() => budgetCategories.id, { onDelete: 'cascade' }),
  monthKey:   text('month_key').notNull(),
  amount:     real('amount').notNull(),
  createdAt:  integer('created_at').notNull(),
}, t => ({
  catMonthUnique: uniqueIndex('budget_limits_cat_month_unique').on(t.categoryId, t.monthKey),
}));
```

- [ ] **Step 2: Add `categoryId` column to existing `cashFlowEntries` table**

Find the `cashFlowEntries` declaration (around line 107) and add `categoryId` after `sourceRefId`:

```ts
export const cashFlowEntries = sqliteTable('cash_flow_entries', {
  id:          text('id').primaryKey(),
  monthId:     text('month_id').notNull().references(() => cashFlowMonths.id, { onDelete: 'cascade' }),
  day:         integer('day').notNull(),
  date:        text('date').notNull(),
  description: text('description').notNull().default(''),
  note:        text('note'),
  entrada:     real('entrada').notNull().default(0),
  saida:       real('saida').notNull().default(0),
  source:      text('source').notNull().default('manual'),
  sourceRefId: text('source_ref_id'),
  categoryId:  text('category_id').references(() => budgetCategories.id),  // nullable; ON DELETE NO ACTION default
  createdAt:   integer('created_at').notNull(),
}, t => ({
  uniqSrc: uniqueIndex('cash_flow_entries_src_uniq').on(t.monthId, t.source, t.sourceRefId),
}));
```

- [ ] **Step 3: Add type exports at the bottom of the file**

After the existing `export type PortfolioSnapshot ...` line, append:

```ts
export type BudgetCategory = typeof budgetCategories.$inferSelect;
export type BudgetLimit    = typeof budgetLimits.$inferSelect;
```

- [ ] **Step 4: Push schema to the dev DB**

Run: `npm run db:push`
Expected: drizzle-kit confirms `budget_categories`, `budget_limits` created and `category_id` column added to `cash_flow_entries`. Answer `Yes` if it asks about applying changes.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(budgets): add budget_categories, budget_limits, cash_flow_entries.category_id"
```

---

## Task 2: Regenerate test fixture schema

**Files:**
- Modify: `src/__tests__/fixtures/schema.sql`

- [ ] **Step 1: Add `categoryId` column to the `cash_flow_entries` CREATE TABLE block**

Find the `CREATE TABLE \`cash_flow_entries\`` block (lines 32-45). Replace it with:

```sql
CREATE TABLE `cash_flow_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`month_id` text NOT NULL,
	`day` integer NOT NULL,
	`date` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`note` text,
	`entrada` real DEFAULT 0 NOT NULL,
	`saida` real DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref_id` text,
	`category_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`month_id`) REFERENCES `cash_flow_months`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `budget_categories`(`id`) ON UPDATE no action ON DELETE no action
);
```

- [ ] **Step 2: Add two new CREATE TABLE blocks before the `CREATE UNIQUE INDEX` lines (i.e., before line 112)**

Insert the following so `budget_categories` is created before any table that references it (the FK in `cash_flow_entries` will need it to exist; SQLite resolves FKs at write time, not create time, so order is forgiving but keep it tidy):

```sql
CREATE TABLE `budget_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`carryover` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_archived` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
CREATE TABLE `budget_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`month_key` text NOT NULL,
	`amount` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `budget_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
```

- [ ] **Step 3: Add two new unique indexes at the bottom of the file (after the existing indexes)**

Append after line 115 (`CREATE UNIQUE INDEX \`transactions_pluggy_id_unique\` ...`):

```sql
CREATE UNIQUE INDEX `budget_categories_name_unique` ON `budget_categories` (`name` COLLATE NOCASE);
CREATE UNIQUE INDEX `budget_limits_cat_month_unique` ON `budget_limits` (`category_id`,`month_key`);
```

- [ ] **Step 4: Run the existing test suite to confirm nothing broke**

Run: `npm run test:run`
Expected: All existing tests pass. The new tables exist but no test touches them yet.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/fixtures/schema.sql
git commit -m "test(budgets): regenerate fixture schema with budget tables + category_id"
```

---

## Task 3: budget-seed.ts skeleton — constants only (no logic yet)

**Files:**
- Create: `src/lib/budget-seed.ts`

This task lands the data constants in isolation so the next tasks can reference them.

- [ ] **Step 1: Create `src/lib/budget-seed.ts` with curated seed + keyword bridge**

```ts
import type { BudgetCategory } from '@/db/schema';

/**
 * Curated taxonomy. IDs are stable, human-readable slugs so seed is idempotent
 * by primary key and not just by name.
 */
export interface CuratedCategory {
  id:        string;
  name:      string;
  kind:      'expense' | 'income';
  color:     string;
  icon:      string;
  carryover: 0 | 1;
  sortOrder: number;
}

export const CURATED_SEED: CuratedCategory[] = [
  { id: 'cat_moradia',       name: 'Moradia',       kind: 'expense', color: '#a78bfa', icon: '🏠', carryover: 0, sortOrder: 10 },
  { id: 'cat_mercado',       name: 'Mercado',       kind: 'expense', color: '#34d399', icon: '🛒', carryover: 0, sortOrder: 20 },
  { id: 'cat_transporte',    name: 'Transporte',    kind: 'expense', color: '#fbbf24', icon: '🚗', carryover: 0, sortOrder: 30 },
  { id: 'cat_lazer',         name: 'Lazer',         kind: 'expense', color: '#f87171', icon: '🎬', carryover: 0, sortOrder: 40 },
  { id: 'cat_saude',         name: 'Saúde',         kind: 'expense', color: '#60a5fa', icon: '⚕️', carryover: 0, sortOrder: 50 },
  { id: 'cat_educacao',      name: 'Educação',      kind: 'expense', color: '#f472b6', icon: '📚', carryover: 0, sortOrder: 60 },
  { id: 'cat_assinaturas',   name: 'Assinaturas',   kind: 'expense', color: '#818cf8', icon: '📺', carryover: 0, sortOrder: 70 },
  { id: 'cat_trabalho',      name: 'Trabalho',      kind: 'expense', color: '#14b8a6', icon: '💼', carryover: 0, sortOrder: 80 },
  { id: 'cat_investimentos', name: 'Investimentos', kind: 'expense', color: '#22d3ee', icon: '📈', carryover: 0, sortOrder: 90 },
  { id: 'cat_outros',        name: 'Outros',        kind: 'expense', color: '#9ca3af', icon: '⚪', carryover: 0, sortOrder: 100 },
  { id: 'cat_salario',       name: 'Salário',       kind: 'income',  color: '#34d399', icon: '💰', carryover: 0, sortOrder: 10 },
  { id: 'cat_outros_rec',    name: 'Outros (rec.)', kind: 'income',  color: '#9ca3af', icon: '⚪', carryover: 0, sortOrder: 100 },
];

/**
 * Bridges `auto-detect.ts` KEYWORDS output (category field) to the curated taxonomy.
 * Without this, Netflix → Streaming → Outros (wrong). With it, Netflix → Streaming → Assinaturas.
 */
export const KEYWORD_CATEGORY_MAP: Record<string, string> = {
  Streaming: 'Assinaturas',
  IA:        'Assinaturas',
  Outros:    'Outros',
  // Extend as new auto-detect.ts KEYWORDS categories appear.
};

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// Function stubs filled in subsequent tasks.
export type BindResult = { bound: number; unmatched: string[] };
export type SeedDeps = { now?: () => number };

export function seedCuratedCategories(_deps?: SeedDeps): { inserted: number; skipped: number } {
  throw new Error('not implemented yet — Task 4');
}

export function resolveCategoryId(_raw: string, _categories: BudgetCategory[]): string | null {
  throw new Error('not implemented yet — Task 5');
}

export function bindLegacyCategories(): BindResult {
  throw new Error('not implemented yet — Task 6');
}
```

- [ ] **Step 2: Run typecheck to confirm the file compiles**

Run: `npx tsc --noEmit`
Expected: No errors. (The thrown stubs are deliberate — they will be replaced with implementations next.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/budget-seed.ts
git commit -m "feat(budgets): add curated seed and keyword-category bridge constants"
```

---

## Task 4: seedCuratedCategories — TDD

**Files:**
- Create: `src/__tests__/budget-seed.test.ts`
- Modify: `src/lib/budget-seed.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/budget-seed.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { Database as DBType } from 'better-sqlite3';

vi.mock('@/db/client', async () => {
  const Database = (await import('better-sqlite3')).default;
  const fs       = await import('fs');
  const path     = await import('path');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema   = await import('@/db/schema');

  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'src/__tests__/fixtures/schema.sql'),
    'utf8',
  );
  sqlite.exec(sql);
  (globalThis as any).__testSqlite = sqlite;
  return { db: drizzle(sqlite, { schema }) };
});

const getSqlite = (): DBType => (globalThis as any).__testSqlite;

const clearAll = () => {
  const sq = getSqlite();
  sq.exec('DELETE FROM cash_flow_entries;');
  sq.exec('DELETE FROM cash_flow_months;');
  sq.exec('DELETE FROM budget_limits;');
  sq.exec('DELETE FROM budget_categories;');
  sq.exec('DELETE FROM subscriptions;');
  sq.exec('DELETE FROM bills;');
  sq.exec('DELETE FROM transactions;');
  sq.exec('DELETE FROM accounts;');
};

beforeAll(async () => { await import('@/db/client'); });
beforeEach(() => { clearAll(); });

describe('seedCuratedCategories', () => {
  it('inserts the full curated taxonomy on an empty DB', async () => {
    const { seedCuratedCategories, CURATED_SEED } = await import('@/lib/budget-seed');
    const res = seedCuratedCategories({ now: () => 1234 });
    expect(res.inserted).toBe(CURATED_SEED.length);
    expect(res.skipped).toBe(0);
    const row = getSqlite()
      .prepare(`SELECT id, name, kind, color, icon, carryover, sort_order, is_archived, created_at
                FROM budget_categories WHERE id = 'cat_moradia'`)
      .get() as Record<string, unknown>;
    expect(row).toMatchObject({
      id: 'cat_moradia',
      name: 'Moradia',
      kind: 'expense',
      icon: '🏠',
      carryover: 0,
      is_archived: 0,
      created_at: 1234,
    });
  });

  it('is idempotent — second call inserts nothing', async () => {
    const { seedCuratedCategories } = await import('@/lib/budget-seed');
    const first = seedCuratedCategories();
    const second = seedCuratedCategories();
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(first.inserted);
    const count = (getSqlite()
      .prepare('SELECT COUNT(*) AS c FROM budget_categories')
      .get() as { c: number }).c;
    expect(count).toBe(first.inserted);
  });

  it('rejects case-variant duplicates via COLLATE NOCASE unique index', async () => {
    const { seedCuratedCategories } = await import('@/lib/budget-seed');
    seedCuratedCategories();
    expect(() =>
      getSqlite()
        .prepare(
          `INSERT INTO budget_categories (id,name,kind,color,icon,carryover,sort_order,is_archived,created_at)
           VALUES ('x','MORADIA','expense','#000','x',0,0,0,0)`,
        )
        .run(),
    ).toThrow(/UNIQUE/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- budget-seed`
Expected: 3 failures — `not implemented yet — Task 4` on the seed tests; the unique-index test currently can't reach the throw assertion because the seed throws first.

- [ ] **Step 3: Implement `seedCuratedCategories`**

Replace the stub in `src/lib/budget-seed.ts`:

```ts
import { db } from '@/db/client';
import { budgetCategories, type BudgetCategory } from '@/db/schema';
import { sql } from 'drizzle-orm';

export function seedCuratedCategories(deps?: SeedDeps): { inserted: number; skipped: number } {
  const now = deps?.now?.() ?? Date.now();
  let inserted = 0;
  let skipped  = 0;
  const sqlite = (db as unknown as { $client: import('better-sqlite3').Database }).$client;
  const stmt = sqlite.prepare(
    `INSERT INTO budget_categories
       (id, name, kind, color, icon, carryover, sort_order, is_archived, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(id) DO NOTHING`,
  );
  for (const c of CURATED_SEED) {
    const r = stmt.run(c.id, c.name, c.kind, c.color, c.icon, c.carryover, c.sortOrder, now);
    if (r.changes === 1) inserted++;
    else                 skipped++;
  }
  return { inserted, skipped };
}
```

**Note on `(db as unknown as ...).$client`:** drizzle's better-sqlite3 wrapper exposes the raw `Database` handle under `$client`. We use it here because `ON CONFLICT(id) DO NOTHING` is a SQLite-specific construct, and going through the raw prepared statement is simpler than building it through drizzle's query builder. If `$client` is not present in the runtime drizzle version, fall back to: `import Database from 'better-sqlite3'; const sqlite = new Database(...)` — but since `@/db/client` already owns the handle, prefer the cast.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- budget-seed`
Expected: 3 passes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/budget-seed.ts src/__tests__/budget-seed.test.ts
git commit -m "feat(budgets): seedCuratedCategories idempotent insert"
```

---

## Task 5: resolveCategoryId — TDD

**Files:**
- Modify: `src/__tests__/budget-seed.test.ts`
- Modify: `src/lib/budget-seed.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/budget-seed.test.ts` (inside the file, after the existing `describe('seedCuratedCategories', ...)` block):

```ts
describe('resolveCategoryId', () => {
  it('Pass 1 — direct curated name hits', async () => {
    const { seedCuratedCategories, resolveCategoryId } = await import('@/lib/budget-seed');
    const { db } = await import('@/db/client');
    const { budgetCategories } = await import('@/db/schema');
    seedCuratedCategories();
    const cats = await db.select().from(budgetCategories);
    expect(resolveCategoryId('Assinaturas', cats)).toBe('cat_assinaturas');
    expect(resolveCategoryId('MORADIA', cats)).toBe('cat_moradia');   // case-insensitive
    expect(resolveCategoryId('saude', cats)).toBe('cat_saude');       // accent-stripped
  });

  it('Pass 2 — KEYWORD bridge: Streaming → Assinaturas', async () => {
    const { seedCuratedCategories, resolveCategoryId } = await import('@/lib/budget-seed');
    const { db } = await import('@/db/client');
    const { budgetCategories } = await import('@/db/schema');
    seedCuratedCategories();
    const cats = await db.select().from(budgetCategories);
    expect(resolveCategoryId('Streaming', cats)).toBe('cat_assinaturas');
    expect(resolveCategoryId('IA', cats)).toBe('cat_assinaturas');
  });

  it('Pass 2 — KEYWORDS substring match on description-like input', async () => {
    const { seedCuratedCategories, resolveCategoryId } = await import('@/lib/budget-seed');
    const { db } = await import('@/db/client');
    const { budgetCategories } = await import('@/db/schema');
    seedCuratedCategories();
    const cats = await db.select().from(budgetCategories);
    expect(resolveCategoryId('NETFLIX.COM 12/12', cats)).toBe('cat_assinaturas');
    expect(resolveCategoryId('SPOTIFY BRASIL', cats)).toBe('cat_assinaturas');
  });

  it('falls back to Outros on unknown input', async () => {
    const { seedCuratedCategories, resolveCategoryId } = await import('@/lib/budget-seed');
    const { db } = await import('@/db/client');
    const { budgetCategories } = await import('@/db/schema');
    seedCuratedCategories();
    const cats = await db.select().from(budgetCategories);
    expect(resolveCategoryId('PADARIA PAO QUENTE', cats)).toBe('cat_outros');
    expect(resolveCategoryId('', cats)).toBe('cat_outros');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- budget-seed`
Expected: 4 new failures with `not implemented yet — Task 5`.

- [ ] **Step 3: Implement `resolveCategoryId`**

First, copy the `KEYWORDS` map shape from `src/lib/auto-detect.ts` into a local helper. We can't import `KEYWORDS` directly because it's not exported there; export it now.

Edit `src/lib/auto-detect.ts` — change line 17 from:

```ts
const KEYWORDS: Record<string, { name: string; category: string }> = {
```

to:

```ts
export const KEYWORDS: Record<string, { name: string; category: string }> = {
```

(One word changed: `const` → `export const`. Nothing else in `auto-detect.ts` moves.)

Then replace the stub in `src/lib/budget-seed.ts`:

```ts
import { KEYWORDS } from '@/lib/auto-detect';

export function resolveCategoryId(raw: string, categories: BudgetCategory[]): string | null {
  const aliasTable = new Map<string, string>();
  for (const c of categories) aliasTable.set(normalize(c.name), c.id);

  // Pass 1: direct curated name lookup
  const direct = aliasTable.get(normalize(raw));
  if (direct) return direct;

  // Pass 2: KEYWORDS substring → keyword.category → bridge → curated
  const lower = raw.toLowerCase();
  for (const [kw, meta] of Object.entries(KEYWORDS)) {
    if (lower.includes(kw)) {
      const bridged = KEYWORD_CATEGORY_MAP[meta.category];
      if (bridged) {
        const id = aliasTable.get(normalize(bridged));
        if (id) return id;
      }
    }
  }

  // Bridge a raw keyword category passed directly (e.g. resolveCategoryId('Streaming', cats))
  const directBridge = KEYWORD_CATEGORY_MAP[raw];
  if (directBridge) {
    const id = aliasTable.get(normalize(directBridge));
    if (id) return id;
  }

  // Default → Outros
  return aliasTable.get(normalize('Outros')) ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- budget-seed`
Expected: all 7 tests pass (3 seed + 4 resolver).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auto-detect.ts src/lib/budget-seed.ts src/__tests__/budget-seed.test.ts
git commit -m "feat(budgets): resolveCategoryId two-pass lookup with KEYWORD bridge"
```

---

## Task 6: bindLegacyCategories — TDD

**Files:**
- Modify: `src/__tests__/budget-seed.test.ts`
- Modify: `src/lib/budget-seed.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/budget-seed.test.ts`:

```ts
describe('bindLegacyCategories', () => {
  const insertMonth = () => getSqlite()
    .prepare(`INSERT INTO cash_flow_months (id,key,name,opening_balance,inherit_opening,created_at,updated_at)
              VALUES ('m1','2026-05','maio',0,0,0,0)`)
    .run();

  const insertSub = (id: string, name: string, category: string) => getSqlite()
    .prepare(`INSERT INTO subscriptions (id,name,amount,billing_day,category,source,alert_days,is_active,created_at)
              VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, name, 50, 15, category, 'manual', 3, 1, 0);

  const insertBill = (id: string, name: string, category: string) => getSqlite()
    .prepare(`INSERT INTO bills (id,name,amount,due_day,category,source,is_paid,paid_at,needs_review,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, name, 1500, 5, category, 'manual', 0, null, 0, 0);

  const insertEntry = (id: string, source: string, sourceRefId: string | null) => getSqlite()
    .prepare(`INSERT INTO cash_flow_entries
              (id,month_id,day,date,description,note,entrada,saida,source,source_ref_id,category_id,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, 'm1', 1, '2026-05-01', '', null, 0, 50, source, sourceRefId, null, 0);

  const getEntryCat = (id: string) =>
    (getSqlite().prepare('SELECT category_id FROM cash_flow_entries WHERE id = ?').get(id) as { category_id: string | null }).category_id;

  it('binds subscription-linked entries via sourceRefId → sub.name → resolver', async () => {
    const { seedCuratedCategories, bindLegacyCategories } = await import('@/lib/budget-seed');
    seedCuratedCategories();
    insertMonth();
    insertSub('s_netflix', 'Netflix', 'Streaming');
    insertEntry('e1', 'subscription', 's_netflix');

    const res = bindLegacyCategories();
    expect(res.bound).toBe(1);
    expect(getEntryCat('e1')).toBe('cat_assinaturas');
  });

  it('falls back to bill.category when name does not resolve', async () => {
    const { seedCuratedCategories, bindLegacyCategories } = await import('@/lib/budget-seed');
    seedCuratedCategories();
    insertMonth();
    insertBill('b_alug', 'Aluguel apartamento', 'Moradia');   // name unknown to KEYWORDS; category direct
    insertEntry('e2', 'bill', 'b_alug');

    const res = bindLegacyCategories();
    expect(res.bound).toBe(1);
    expect(getEntryCat('e2')).toBe('cat_moradia');
  });

  it('lands unmatched in Outros and logs them', async () => {
    const { seedCuratedCategories, bindLegacyCategories } = await import('@/lib/budget-seed');
    seedCuratedCategories();
    insertMonth();
    insertBill('b_x', 'Coisa Qualquer Z', 'Outros');
    insertEntry('e3', 'bill', 'b_x');

    const res = bindLegacyCategories();
    expect(res.bound).toBe(1);
    expect(getEntryCat('e3')).toBe('cat_outros');
    expect(res.unmatched).toContain('bill:b_x');
  });

  it('leaves manual entries (no sourceRefId) untouched', async () => {
    const { seedCuratedCategories, bindLegacyCategories } = await import('@/lib/budget-seed');
    seedCuratedCategories();
    insertMonth();
    insertEntry('e4', 'manual', null);

    const res = bindLegacyCategories();
    expect(res.bound).toBe(0);
    expect(getEntryCat('e4')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- budget-seed`
Expected: 4 new failures with `not implemented yet — Task 6`.

- [ ] **Step 3: Implement `bindLegacyCategories`**

Replace the stub in `src/lib/budget-seed.ts`. Resolution order matches spec §regression: `name` first (KEYWORDS-bridged), then `category`, then `Outros`.

```ts
export function bindLegacyCategories(): BindResult {
  const sqlite = (db as unknown as { $client: import('better-sqlite3').Database }).$client;

  type LegacyRef = { id: string; name: string; category: string };
  const subs:  LegacyRef[] = sqlite.prepare(`SELECT id, name, category FROM subscriptions`).all() as LegacyRef[];
  const bills: LegacyRef[] = sqlite.prepare(`SELECT id, name, category FROM bills`).all()         as LegacyRef[];

  const cats = sqlite.prepare(
    `SELECT id, name, kind, color, icon, carryover, sort_order AS sortOrder,
            is_archived AS isArchived, created_at AS createdAt
     FROM budget_categories`,
  ).all() as BudgetCategory[];

  const outrosId = cats.find(c => normalize(c.name) === 'outros')?.id ?? null;
  const unmatched: string[] = [];

  const resolveFor = (ref: LegacyRef, kind: 'bill' | 'subscription'): string | null => {
    const byName = resolveCategoryId(ref.name, cats);
    if (byName && byName !== outrosId) return byName;
    const byCat = resolveCategoryId(ref.category, cats);
    if (byCat && byCat !== outrosId) return byCat;
    unmatched.push(`${kind}:${ref.id}`);
    return outrosId;
  };

  const updateEntry = sqlite.prepare(
    `UPDATE cash_flow_entries SET category_id = ? WHERE source = ? AND source_ref_id = ?`,
  );

  let bound = 0;
  const tx = sqlite.transaction(() => {
    for (const s of subs) {
      const catId = resolveFor(s, 'subscription');
      if (catId) bound += updateEntry.run(catId, 'subscription', s.id).changes;
    }
    for (const b of bills) {
      const catId = resolveFor(b, 'bill');
      if (catId) bound += updateEntry.run(catId, 'bill', b.id).changes;
    }
  });
  tx();

  return { bound, unmatched };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- budget-seed`
Expected: all 11 tests pass (3 seed + 4 resolver + 4 bind).

- [ ] **Step 5: Run the full test suite to confirm no regression**

Run: `npm run test:run`
Expected: all pre-existing tests still pass (cashflow-api, etc.).

- [ ] **Step 6: Commit**

```bash
git add src/lib/budget-seed.ts src/__tests__/budget-seed.test.ts
git commit -m "feat(budgets): bindLegacyCategories with name-first resolution order"
```

---

## Task 7: CLI migration runner

**Files:**
- Create: `scripts/migrate-budgets.ts`

This is a one-shot script. No unit test — the underlying helpers are already covered. Smoke-test by running it against the dev DB after Task 1's `db:push`.

- [ ] **Step 1: Create the script**

```ts
/* eslint-disable no-console */
import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import { db } from '@/db/client';
import { seedCuratedCategories, bindLegacyCategories } from '@/lib/budget-seed';

function main(): void {
  const sqlite = (db as unknown as { $client: Database.Database }).$client;
  const ts = Date.now();
  const backupTable = `cash_flow_entries_backup_${ts}`;

  console.log(`[migrate-budgets] backing up cash_flow_entries → ${backupTable}`);
  sqlite.exec(
    `CREATE TABLE ${backupTable} AS SELECT * FROM cash_flow_entries;`,
  );

  console.log('[migrate-budgets] seeding curated categories');
  const seedRes = seedCuratedCategories();
  console.log(`  inserted=${seedRes.inserted} skipped=${seedRes.skipped}`);

  console.log('[migrate-budgets] binding legacy bill/sub categories');
  const bindRes = bindLegacyCategories();
  console.log(`  bound=${bindRes.bound} unmatched=${bindRes.unmatched.length}`);

  if (bindRes.unmatched.length > 0) {
    console.log('[migrate-budgets] unmatched legacy refs (landed in Outros):');
    for (const ref of bindRes.unmatched) console.log(`  - ${ref}`);
  }

  console.log('[migrate-budgets] done.');
}

main();
```

- [ ] **Step 2: Add an npm script**

Edit `package.json` `scripts` block — add after `"db:push": "drizzle-kit push"` (insert a comma after the previous line):

```json
"migrate:budgets": "tsx scripts/migrate-budgets.ts"
```

Then install `tsx` if not already present:

Run: `npm ls tsx`
Expected: either tsx is listed (skip the next command) or "(empty)" / not-found error.

If not present:

Run: `npm install --save-dev tsx`
Expected: tsx added to devDependencies.

- [ ] **Step 3: Smoke-test against the dev DB**

Run: `npm run migrate:budgets`
Expected output (counts depend on data; example):

```
[migrate-budgets] backing up cash_flow_entries → cash_flow_entries_backup_<ts>
[migrate-budgets] seeding curated categories
  inserted=12 skipped=0     # first run; subsequent runs: inserted=0 skipped=12
[migrate-budgets] binding legacy bill/sub categories
  bound=<N> unmatched=<M>
[migrate-budgets] done.
```

Verify in DB:

Run: `npx tsx -e "const db = require('better-sqlite3')('./lifeos.db'); console.log(db.prepare('SELECT id,name FROM budget_categories').all()); console.log(db.prepare('SELECT COUNT(*) c FROM cash_flow_entries WHERE category_id IS NOT NULL').get());"`
Expected: 12 curated categories listed; non-zero count of entries with `category_id` populated.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-budgets.ts package.json package-lock.json
git commit -m "feat(budgets): scripts/migrate-budgets.ts CLI with backup + transaction"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full test suite green**

Run: `npm run test:run`
Expected: all tests pass.

- [ ] **Step 2: TypeScript clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint clean (if next lint configured)**

Run: `npm run lint 2>/dev/null || echo "no lint script — skipping"`
Expected: no errors, or the skip notice.

- [ ] **Step 4: Confirm `git status` is clean and the branch is one logical chain of commits**

Run: `git status && git log --oneline -10`
Expected: clean working tree; commits visible in order:
1. `feat(budgets): add budget_categories, budget_limits, cash_flow_entries.category_id`
2. `test(budgets): regenerate fixture schema with budget tables + category_id`
3. `feat(budgets): add curated seed and keyword-category bridge constants`
4. `feat(budgets): seedCuratedCategories idempotent insert`
5. `feat(budgets): resolveCategoryId two-pass lookup with KEYWORD bridge`
6. `feat(budgets): bindLegacyCategories with name-first resolution order`
7. `feat(budgets): scripts/migrate-budgets.ts CLI with backup + transaction`

- [ ] **Step 5: Push**

Run: `git push`
Expected: branch updated on origin.

---

## Spec coverage check (self-review)

| Spec §5 Slice 1 requirement | Task |
|---|---|
| `src/db/schema.ts` ALTER | Task 1 |
| `src/lib/budget-seed.ts` NEW | Tasks 3-6 |
| `scripts/migrate-budgets.ts` NEW | Task 7 |
| `src/__tests__/budget-seed.test.ts` NEW | Tasks 4-6 |
| Migration step 1 (`db:push`) | Task 1 step 4 |
| Migration step 2 (idempotent seed) | Task 4 |
| Migration step 3 (subscriptions distinct) | Implicit in Task 6 via `bindLegacyCategories` reading all subs |
| Migration step 4 (KEYWORD_CATEGORY_MAP) | Task 5 |
| Migration step 5 (UPDATE cashFlowEntries via sourceRefId) | Task 6 |
| Migration step 6 (Outros fallback + log) | Task 6 |
| Migration step 7 (backup + transaction) | Task 7 |
| Migration step 8 (script imports shared helpers) | Task 7 |
| COLLATE NOCASE on `name` | Task 1 step 1 + Task 2 step 3 |
| `ON DELETE NO ACTION` on `categoryId` | Task 1 step 2 (default) + Task 2 step 1 |
| Curated seed (12 rows) | Task 3 |
| Test: KEYWORD_CATEGORY_MAP (Netflix → Streaming → Assinaturas) | Task 5 |
| Test: case-insensitive uniqueness | Task 4 step 1 |
| Fixture schema.sql regen | Task 2 |

All §5 Slice 1 bullets accounted for. §6 type contracts that belong to Slice 3 (`computeBudgetMonth`, `BudgetRow`, etc.) are out of scope here and land later.

---

## Out of scope (lands in later slices)

- `src/lib/budgets.ts` (`computeBudgetMonth`, `effectiveCategoryId`) — Slice 3
- `/api/budgets/*` route handlers — Slice 2
- `/orcamento` config page — Slice 2
- `/fluxo` sidebar lane — Slice 3
- Reconciliation + alerts — Slice 4
