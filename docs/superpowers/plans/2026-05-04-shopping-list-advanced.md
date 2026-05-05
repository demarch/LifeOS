# Shopping List Advanced — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add item quantities, a reusable base list, session history with frequency tracking, and a "start new shopping trip" modal to the existing shopping list.

**Architecture:** Four-table SQLite schema (baseListItems, updated shoppingItems, shoppingSessions, shoppingSessionItems) plus new API routes under /api/shopping/, two new sub-pages (/lista/base, /lista/historico), and updates to the existing ShoppingList client component.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM + better-sqlite3, Vitest, TypeScript, React 18 Client Components.

---

## File Map

**Modified:**
- `src/db/schema.ts` — add 3 new tables, add `qty` + `baseListItemId` columns to `shoppingItems`
- `src/app/api/shopping/route.ts` — accept `qty` in POST body
- `src/app/api/shopping/[id]/route.ts` — accept `qty` in PATCH body
- `src/components/pages/lista/shopping-list.tsx` — qty controls, session close, modal trigger
- `src/app/lista/page.tsx` — sub-nav tabs, remove broken "Limpar marcados" from header
- `src/app/globals.css` — qty-ctrl, modal, lista-tabs, base-item, hist-session styles

**Created:**
- `src/lib/shopping-frequency.ts` — pure fn `buildFrequencyRanking()`
- `src/__tests__/shopping-frequency.test.ts` — vitest tests for above
- `src/app/api/shopping/base/route.ts` — GET + POST baseListItems
- `src/app/api/shopping/base/[id]/route.ts` — PATCH + DELETE baseListItems
- `src/app/api/shopping/sessions/route.ts` — POST (close session), GET (list sessions)
- `src/app/api/shopping/sessions/[id]/route.ts` — GET session items
- `src/app/api/shopping/from-base/route.ts` — POST (copy base → active list)
- `src/app/api/shopping/frequency/route.ts` — GET frequency ranking
- `src/components/pages/lista/new-session-modal.tsx` — "Iniciar nova compra?" modal
- `src/components/pages/lista/base-list.tsx` — base list CRUD client component
- `src/components/pages/lista/historico.tsx` — sessions + frequency client component
- `src/app/lista/base/page.tsx` — base list page (Server Component)
- `src/app/lista/historico/page.tsx` — histórico page (Server Component)

---

### Task 1: Schema — add tables and columns

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Open `src/db/schema.ts` and replace its content with the new version**

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id:         text('id').primaryKey(),
  pluggyId:   text('pluggy_id').unique(),
  name:       text('name').notNull(),
  bank:       text('bank').notNull(),
  type:       text('type').notNull(),           // 'checking' | 'credit' | 'investment'
  balance:    real('balance').notNull().default(0),
  color:      text('color').notNull(),
  last4:      text('last4'),
  limit:      real('limit'),
  updatedAt:  integer('updated_at').notNull(),
});

export const transactions = sqliteTable('transactions', {
  id:          text('id').primaryKey(),
  pluggyId:    text('pluggy_id').unique(),
  accountId:   text('account_id').notNull().references(() => accounts.id),
  description: text('description').notNull(),
  amount:      real('amount').notNull(),         // negative = debit
  type:        text('type').notNull(),           // 'debit' | 'credit' | 'transfer'
  category:    text('category').notNull().default(''),
  date:        text('date').notNull(),           // YYYY-MM-DD
  createdAt:   integer('created_at').notNull(),
});

export const bills = sqliteTable('bills', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  amount:      real('amount'),
  dueDay:      integer('due_day').notNull(),
  category:    text('category').notNull(),
  source:      text('source').notNull().default('manual'),
  isPaid:      integer('is_paid').notNull().default(0),
  paidAt:      integer('paid_at'),
  needsReview: integer('needs_review').notNull().default(0),
  createdAt:   integer('created_at').notNull(),
});

export const subscriptions = sqliteTable('subscriptions', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull(),
  amount:     real('amount').notNull(),
  billingDay: integer('billing_day').notNull(),
  category:   text('category').notNull(),
  source:     text('source').notNull().default('manual'),
  alertDays:  integer('alert_days').notNull().default(3),
  isActive:   integer('is_active').notNull().default(1),
  createdAt:  integer('created_at').notNull(),
});

export const baseListItems = sqliteTable('base_list_items', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull(),
  category:   text('category').notNull(),
  defaultQty: integer('default_qty').notNull().default(1),
  createdAt:  integer('created_at').notNull(),
});

export const shoppingItems = sqliteTable('shopping_items', {
  id:             text('id').primaryKey(),
  name:           text('name').notNull(),
  category:       text('category').notNull(),
  qty:            integer('qty').notNull().default(1),
  isRecurring:    integer('is_recurring').notNull().default(0),
  isChecked:      integer('is_checked').notNull().default(0),
  baseListItemId: text('base_list_item_id').references(() => baseListItems.id),
  createdAt:      integer('created_at').notNull(),
});

export const shoppingSessions = sqliteTable('shopping_sessions', {
  id:           text('id').primaryKey(),
  completedAt:  integer('completed_at').notNull(),
  totalItems:   integer('total_items').notNull(),
  totalChecked: integer('total_checked').notNull(),
});

export const shoppingSessionItems = sqliteTable('shopping_session_items', {
  id:             text('id').primaryKey(),
  sessionId:      text('session_id').notNull().references(() => shoppingSessions.id),
  name:           text('name').notNull(),
  category:       text('category').notNull(),
  qty:            integer('qty').notNull().default(1),
  baseListItemId: text('base_list_item_id').references(() => baseListItems.id),
});

export const syncLog = sqliteTable('sync_log', {
  id:                  text('id').primaryKey(),
  status:              text('status').notNull(),
  accountsSynced:      integer('accounts_synced').notNull().default(0),
  transactionsSynced:  integer('transactions_synced').notNull().default(0),
  errorMsg:            text('error_msg'),
  syncedAt:            integer('synced_at').notNull(),
});

export type Account           = typeof accounts.$inferSelect;
export type Transaction       = typeof transactions.$inferSelect;
export type Bill              = typeof bills.$inferSelect;
export type Subscription      = typeof subscriptions.$inferSelect;
export type BaseListItem      = typeof baseListItems.$inferSelect;
export type ShoppingItem      = typeof shoppingItems.$inferSelect;
export type ShoppingSession   = typeof shoppingSessions.$inferSelect;
export type ShoppingSessionItem = typeof shoppingSessionItems.$inferSelect;
export type SyncLogEntry      = typeof syncLog.$inferSelect;
```

- [ ] **Step 2: Push schema to DB**

Run: `npm run db:push`

Expected: Drizzle prints "Changes applied" with new tables created and columns added to `shopping_items`. No data loss (existing rows get `qty=1`, `base_list_item_id=NULL`).

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(lista): add baseListItems, shoppingSessions, shoppingSessionItems tables; add qty + baseListItemId to shoppingItems"
```

---

### Task 2: Frequency utility + tests

**Files:**
- Create: `src/lib/shopping-frequency.ts`
- Create: `src/__tests__/shopping-frequency.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/shopping-frequency.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildFrequencyRanking } from '@/lib/shopping-frequency';

describe('buildFrequencyRanking', () => {
  it('returns empty array for no input', () => {
    expect(buildFrequencyRanking([])).toEqual([]);
  });

  it('counts single item once', () => {
    const rows = [{ name: 'Leite', category: 'Mercado', completedAt: 1000 }];
    const result = buildFrequencyRanking(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Leite', category: 'Mercado', count: 1, lastBoughtAt: 1000 });
  });

  it('merges same item case-insensitively', () => {
    const rows = [
      { name: 'Leite', category: 'Mercado', completedAt: 1000 },
      { name: 'leite', category: 'Mercado', completedAt: 2000 },
    ];
    const result = buildFrequencyRanking(rows);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
    expect(result[0].lastBoughtAt).toBe(2000);
  });

  it('sorts by count descending', () => {
    const rows = [
      { name: 'Pão', category: 'Mercado', completedAt: 1000 },
      { name: 'Leite', category: 'Mercado', completedAt: 1000 },
      { name: 'Leite', category: 'Mercado', completedAt: 2000 },
    ];
    const result = buildFrequencyRanking(rows);
    expect(result[0].name).toBe('Leite');
    expect(result[0].count).toBe(2);
    expect(result[1].name).toBe('Pão');
    expect(result[1].count).toBe(1);
  });

  it('breaks ties by lastBoughtAt descending', () => {
    const rows = [
      { name: 'Pão', category: 'Mercado', completedAt: 500 },
      { name: 'Leite', category: 'Mercado', completedAt: 1000 },
    ];
    const result = buildFrequencyRanking(rows);
    expect(result[0].name).toBe('Leite');
  });

  it('preserves first-seen name casing', () => {
    const rows = [
      { name: 'Leite', category: 'Mercado', completedAt: 1000 },
      { name: 'LEITE', category: 'Mercado', completedAt: 2000 },
    ];
    const result = buildFrequencyRanking(rows);
    expect(result[0].name).toBe('Leite');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm run test:run -- src/__tests__/shopping-frequency.test.ts`

Expected: FAIL — "Cannot find module '@/lib/shopping-frequency'"

- [ ] **Step 3: Create `src/lib/shopping-frequency.ts`**

```typescript
export interface FrequencyEntry {
  name: string;
  category: string;
  count: number;
  lastBoughtAt: number;
}

export function buildFrequencyRanking(
  rows: Array<{ name: string; category: string; completedAt: number }>
): FrequencyEntry[] {
  const map = new Map<string, FrequencyEntry>();
  for (const row of rows) {
    const key = row.name.toLowerCase();
    const entry = map.get(key);
    if (entry) {
      entry.count++;
      if (row.completedAt > entry.lastBoughtAt) entry.lastBoughtAt = row.completedAt;
    } else {
      map.set(key, {
        name: row.name,
        category: row.category,
        count: 1,
        lastBoughtAt: row.completedAt,
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.count - a.count || b.lastBoughtAt - a.lastBoughtAt
  );
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm run test:run -- src/__tests__/shopping-frequency.test.ts`

Expected: 6 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shopping-frequency.ts src/__tests__/shopping-frequency.test.ts
git commit -m "feat(lista): add buildFrequencyRanking pure utility with tests"
```

---

### Task 3: Update active list API — qty support

**Files:**
- Modify: `src/app/api/shopping/route.ts`
- Modify: `src/app/api/shopping/[id]/route.ts`

- [ ] **Step 1: Update `src/app/api/shopping/route.ts`** — add `qty` to POST

Replace full file content:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { shoppingItems } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function GET() {
  const result = db.select().from(shoppingItems).orderBy(asc(shoppingItems.category)).all();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.insert(shoppingItems).values({
    id,
    name: body.name,
    category: body.category ?? 'Outros',
    qty: Math.max(1, Number(body.qty ?? 1)),
    isRecurring: body.isRecurring ? 1 : 0,
    isChecked: 0,
    baseListItemId: body.baseListItemId ?? null,
    createdAt: now,
  }).run();

  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 2: Update `src/app/api/shopping/[id]/route.ts`** — add `qty` to PATCH

Replace full file content:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { shoppingItems } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Params { params: { id: string } }

export async function PATCH(request: Request, { params }: Params) {
  const body = await request.json();
  const updates: Partial<typeof shoppingItems.$inferInsert> = {};
  if ('isChecked' in body) updates.isChecked = body.isChecked ? 1 : 0;
  if ('qty' in body) updates.qty = Math.max(1, Number(body.qty));
  if ('name' in body) updates.name = body.name;
  if ('category' in body) updates.category = body.category;
  if ('isRecurring' in body) updates.isRecurring = body.isRecurring ? 1 : 0;

  db.update(shoppingItems).set(updates).where(eq(shoppingItems.id, params.id)).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
  db.delete(shoppingItems).where(eq(shoppingItems.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shopping/route.ts src/app/api/shopping/[id]/route.ts
git commit -m "feat(lista): add qty field to shopping items API"
```

---

### Task 4: Base list API routes

**Files:**
- Create: `src/app/api/shopping/base/route.ts`
- Create: `src/app/api/shopping/base/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/shopping/base/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { baseListItems } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function GET() {
  const result = db.select().from(baseListItems).orderBy(asc(baseListItems.category)).all();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.insert(baseListItems).values({
    id,
    name: body.name,
    category: body.category ?? 'Outros',
    defaultQty: Math.max(1, Number(body.defaultQty ?? 1)),
    createdAt: now,
  }).run();

  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 2: Create `src/app/api/shopping/base/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { baseListItems } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Params { params: { id: string } }

export async function PATCH(request: Request, { params }: Params) {
  const body = await request.json();
  const updates: Partial<typeof baseListItems.$inferInsert> = {};
  if ('name' in body) updates.name = body.name;
  if ('category' in body) updates.category = body.category;
  if ('defaultQty' in body) updates.defaultQty = Math.max(1, Number(body.defaultQty));

  db.update(baseListItems).set(updates).where(eq(baseListItems.id, params.id)).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
  db.delete(baseListItems).where(eq(baseListItems.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/shopping/base/route.ts "src/app/api/shopping/base/[id]/route.ts"
git commit -m "feat(lista): add base list CRUD API routes"
```

---

### Task 5: Session close + from-base API routes

**Files:**
- Create: `src/app/api/shopping/sessions/route.ts`
- Create: `src/app/api/shopping/sessions/[id]/route.ts`
- Create: `src/app/api/shopping/from-base/route.ts`

- [ ] **Step 1: Create `src/app/api/shopping/sessions/route.ts`**

POST closes the active session (saves checked items as history, deletes them from active list).  
GET returns list of past sessions ordered by most recent first.

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { shoppingItems, shoppingSessions, shoppingSessionItems } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function POST() {
  const now = Math.floor(Date.now() / 1000);
  const allItems = db.select().from(shoppingItems).all();
  const checkedItems = allItems.filter(i => i.isChecked);

  if (checkedItems.length === 0) {
    return NextResponse.json({ ok: true, sessionId: null });
  }

  const sessionId = randomUUID();
  db.insert(shoppingSessions).values({
    id: sessionId,
    completedAt: now,
    totalItems: allItems.length,
    totalChecked: checkedItems.length,
  }).run();

  for (const item of checkedItems) {
    db.insert(shoppingSessionItems).values({
      id: randomUUID(),
      sessionId,
      name: item.name,
      category: item.category,
      qty: item.qty,
      baseListItemId: item.baseListItemId ?? null,
    }).run();
    db.delete(shoppingItems).where(eq(shoppingItems.id, item.id)).run();
  }

  return NextResponse.json({ ok: true, sessionId });
}

export async function GET() {
  const sessions = db.select().from(shoppingSessions)
    .orderBy(desc(shoppingSessions.completedAt)).all();
  return NextResponse.json(sessions);
}
```

- [ ] **Step 2: Create `src/app/api/shopping/sessions/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { shoppingSessionItems } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Params { params: { id: string } }

export async function GET(_: Request, { params }: Params) {
  const items = db.select().from(shoppingSessionItems)
    .where(eq(shoppingSessionItems.sessionId, params.id)).all();
  return NextResponse.json(items);
}
```

- [ ] **Step 3: Create `src/app/api/shopping/from-base/route.ts`**

Copies `baseListItems` into the active `shoppingItems`, skipping items already present (case-insensitive name + category match).

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { baseListItems, shoppingItems } from '@/db/schema';
import { randomUUID } from 'crypto';

export async function POST() {
  const now = Math.floor(Date.now() / 1000);
  const base = db.select().from(baseListItems).all();
  const active = db.select().from(shoppingItems).all();

  const activeKeys = new Set(
    active.map(i => `${i.name.toLowerCase()}|${i.category.toLowerCase()}`)
  );

  const added: string[] = [];
  for (const item of base) {
    const key = `${item.name.toLowerCase()}|${item.category.toLowerCase()}`;
    if (activeKeys.has(key)) continue;

    const id = randomUUID();
    db.insert(shoppingItems).values({
      id,
      name: item.name,
      category: item.category,
      qty: item.defaultQty,
      isRecurring: 0,
      isChecked: 0,
      baseListItemId: item.id,
      createdAt: now,
    }).run();
    added.push(id);
  }

  return NextResponse.json({ added });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/shopping/sessions/route.ts "src/app/api/shopping/sessions/[id]/route.ts" src/app/api/shopping/from-base/route.ts
git commit -m "feat(lista): add session close, session history, and from-base API routes"
```

---

### Task 6: Frequency API route

**Files:**
- Create: `src/app/api/shopping/frequency/route.ts`

- [ ] **Step 1: Create `src/app/api/shopping/frequency/route.ts`**

Joins `shoppingSessionItems` with `shoppingSessions` to get `completedAt`, then uses `buildFrequencyRanking`.

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { shoppingSessionItems, shoppingSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildFrequencyRanking } from '@/lib/shopping-frequency';

export async function GET() {
  const sessions = db.select().from(shoppingSessions).all();
  const sessionMap = new Map(sessions.map(s => [s.id, s.completedAt]));

  const items = db.select().from(shoppingSessionItems).all();
  const rows = items.map(i => ({
    name: i.name,
    category: i.category,
    completedAt: sessionMap.get(i.sessionId) ?? 0,
  }));

  const ranking = buildFrequencyRanking(rows);
  return NextResponse.json(ranking);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/shopping/frequency/route.ts
git commit -m "feat(lista): add item frequency ranking API route"
```

---

### Task 7: CSS additions

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Append new styles to `src/app/globals.css`**

Add at the end of the file:

```css
/* ── Shopping List: quantity controls ── */
.qty-ctrl {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--bg-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  font-family: var(--font-mono); font-size: 12px;
  flex-shrink: 0;
}
.qty-ctrl button {
  background: none; border: 0;
  color: var(--text-2); cursor: pointer;
  font-size: 14px; line-height: 1;
  padding: 0 2px;
  transition: color 0.1s;
}
.qty-ctrl button:hover { color: var(--accent); }
.qty-ctrl span { min-width: 18px; text-align: center; color: var(--text-0); }

/* ── Shopping List: sub-navigation tabs ── */
.lista-tabs {
  display: flex; gap: 2px;
  border-bottom: 1px solid var(--line);
  padding: 0 28px;
  margin-bottom: 24px;
}
.lista-tabs .tab {
  padding: 10px 16px;
  font-size: 13px; color: var(--text-2);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.12s, border-color 0.12s;
}
.lista-tabs .tab:hover { color: var(--text-0); }
.lista-tabs .tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

/* ── Shopping List: modal overlay ── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid; place-items: center;
  z-index: 50;
  backdrop-filter: blur(4px);
}
.modal {
  background: var(--bg-2);
  border: 1px solid var(--line-2);
  border-radius: var(--radius);
  padding: 24px 28px;
  min-width: 340px;
  box-shadow: var(--shadow);
}

/* ── Base list items ── */
.base-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.base-item:last-child { border-bottom: 0; }
.base-item .base-name { flex: 1; font-size: 14px; color: var(--text-0); }
.base-item .base-cat {
  font-size: 11px; color: var(--text-3);
  background: var(--bg-3); border: 1px solid var(--line);
  border-radius: 999px; padding: 2px 8px;
}
.base-item .base-actions { display: flex; gap: 6px; }

/* ── Histórico: session rows ── */
.hist-session {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  margin-bottom: 10px;
  overflow: hidden;
}
.hist-session .hist-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.1s;
}
.hist-session .hist-head:hover { background: var(--bg-3); }
.hist-session .hist-body { padding: 0 16px 12px; }
.hist-session .hist-item {
  display: flex; align-items: center; gap: 10px;
  padding: 5px 0;
  font-size: 13px; color: var(--text-1);
  border-top: 1px solid var(--line);
}
.hist-session .hist-item:first-child { border-top: 0; }

/* ── Histórico: frequency items ── */
.freq-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.freq-item:last-child { border-bottom: 0; }
.freq-item .freq-name { flex: 1; font-size: 14px; color: var(--text-0); }
.freq-item .freq-count {
  font-family: var(--font-mono); font-size: 12px; color: var(--accent);
  background: var(--accent-soft); border-radius: 999px;
  padding: 2px 10px;
}
.freq-item .freq-last { font-size: 11px; color: var(--text-3); }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(lista): add CSS for qty controls, modal, sub-nav tabs, base list, and histórico"
```

---

### Task 8: NewSessionModal component

**Files:**
- Create: `src/components/pages/lista/new-session-modal.tsx`

- [ ] **Step 1: Create `src/components/pages/lista/new-session-modal.tsx`**

```tsx
'use client';

interface NewSessionModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function NewSessionModal({ onConfirm, onCancel }: NewSessionModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Iniciar nova compra?</h3>
        <p style={{ margin: '0 0 20px', color: 'var(--text-2)', fontSize: 13 }}>
          Os itens da sua lista base serão adicionados à lista atual.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onCancel}>Não</button>
          <button className="btn primary" onClick={onConfirm}>Sim</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pages/lista/new-session-modal.tsx
git commit -m "feat(lista): add NewSessionModal component"
```

---

### Task 9: Update ShoppingList component — qty controls + session close

**Files:**
- Modify: `src/components/pages/lista/shopping-list.tsx`

- [ ] **Step 1: Replace `src/components/pages/lista/shopping-list.tsx` with new version**

Changes from current version:
- Add `draftQty` state + qty control in add-item form
- Add `updateQty` handler
- Add `closeSession` handler (POST /api/shopping/sessions, then shows modal)
- Add `onStartNewTrip` handler (POST /api/shopping/from-base, re-fetches list)
- Add `showModal` state + `NewSessionModal` render
- Show qty control per list item
- Export `closeSession` via callback prop so page header button can trigger it

```tsx
'use client';
import { useState } from 'react';
import { Icon } from '@/components/atoms/icon';
import { NewSessionModal } from './new-session-modal';
import type { ShoppingItem } from '@/db/schema';

interface ShoppingListProps {
  initialItems: ShoppingItem[];
  onCloseSessionRef?: (fn: () => void) => void;
}

const CATEGORIES = ['Hortifruti', 'Mercado', 'Limpeza', 'Outros'];

export function ShoppingList({ initialItems, onCloseSessionRef }: ShoppingListProps) {
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState('');
  const [draftCat, setDraftCat] = useState('Mercado');
  const [draftQty, setDraftQty] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const total = items.length;
  const done = items.filter(i => i.isChecked).length;
  const cats = Array.from(new Set(items.map(i => i.category)));

  const toggle = async (item: ShoppingItem) => {
    const next = !item.isChecked;
    await fetch(`/api/shopping/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isChecked: next }),
    });
    setItems(xs => xs.map(x => x.id === item.id ? { ...x, isChecked: next ? 1 : 0 } : x));
  };

  const updateQty = async (item: ShoppingItem, qty: number) => {
    if (qty < 1) return;
    await fetch(`/api/shopping/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty }),
    });
    setItems(xs => xs.map(x => x.id === item.id ? { ...x, qty } : x));
  };

  const addItem = async () => {
    const name = draft.trim();
    if (!name) return;
    const res = await fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category: draftCat, qty: draftQty, isRecurring: false }),
    });
    const { id } = await res.json();
    setItems(xs => [...xs, {
      id, name, category: draftCat, qty: draftQty,
      isRecurring: 0, isChecked: 0,
      baseListItemId: null,
      createdAt: Math.floor(Date.now() / 1000),
    }]);
    setDraft('');
    setDraftQty(1);
  };

  const closeSession = async () => {
    const checkedCount = items.filter(i => i.isChecked).length;
    if (checkedCount === 0) return;
    await fetch('/api/shopping/sessions', { method: 'POST' });
    setItems(xs => xs.filter(x => !x.isChecked));
    setShowModal(true);
  };

  // Expose closeSession to parent header button via ref callback
  if (onCloseSessionRef) onCloseSessionRef(closeSession);

  const onStartNewTrip = async () => {
    setShowModal(false);
    const res = await fetch('/api/shopping/from-base', { method: 'POST' });
    const { added } = await res.json() as { added: string[] };
    if (added.length > 0) {
      const listRes = await fetch('/api/shopping');
      const all = await listRes.json() as ShoppingItem[];
      setItems(all);
    }
  };

  const allCats = Array.from(new Set([...cats, ...CATEGORIES]));

  return (
    <>
      <div className="new-input">
        <Icon name="plus" size={16} color="var(--accent)" />
        <input
          placeholder="Adicionar item à lista…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
        />
        <div className="qty-ctrl">
          <button type="button" onClick={() => setDraftQty(q => Math.max(1, q - 1))}>−</button>
          <span>{draftQty}</span>
          <button type="button" onClick={() => setDraftQty(q => q + 1)}>+</button>
        </div>
        <select
          value={draftCat}
          onChange={e => setDraftCat(e.target.value)}
          style={{
            background: 'var(--bg-3)', color: 'var(--text-1)',
            border: '1px solid var(--line)', borderRadius: 6,
            padding: '4px 8px', fontSize: 12,
          }}
        >
          {allCats.map(c => <option key={c}>{c}</option>)}
        </select>
        <button className="btn primary" onClick={addItem}>Adicionar</button>
      </div>

      {total > 0 && (
        <div className="bar" style={{ marginBottom: 18 }}>
          <span style={{ width: `${(done / total) * 100}%`, background: 'var(--accent)' }} />
        </div>
      )}

      {allCats.map(cat => {
        const list = items.filter(i => i.category === cat);
        if (list.length === 0) return null;
        const ck = list.filter(i => i.isChecked).length;
        return (
          <div key={cat} className="shop-section">
            <div className="head">
              <span>{cat}</span>
              <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {ck}/{list.length}
              </span>
            </div>
            <div>
              {list.map(item => (
                <div
                  key={item.id}
                  className={`shop-item${item.isChecked ? ' checked' : ''}`}
                >
                  <span className="check" onClick={() => toggle(item)}>
                    {item.isChecked && <Icon name="check" size={12} color="#14112b" />}
                  </span>
                  <span className="label" onClick={() => toggle(item)}>{item.name}</span>
                  {!!item.isRecurring && <span className="recur">↻ recorrente</span>}
                  <div className="qty-ctrl" onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => updateQty(item, (item.qty ?? 1) - 1)}>−</button>
                    <span>{item.qty ?? 1}</span>
                    <button type="button" onClick={() => updateQty(item, (item.qty ?? 1) + 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {items.length === 0 && (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>
          Lista vazia — adicione itens acima ou{' '}
          <a href="/lista/base" style={{ color: 'var(--accent)' }}>configure a lista base</a>.
        </div>
      )}

      {showModal && (
        <NewSessionModal
          onConfirm={onStartNewTrip}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pages/lista/shopping-list.tsx
git commit -m "feat(lista): add qty controls, session close flow, and new-trip modal to ShoppingList"
```

---

### Task 10: Update /lista/page.tsx — sub-nav + wire header button

**Files:**
- Modify: `src/app/lista/page.tsx`

The page is a Server Component. The "Limpar marcados" button needs to call `closeSession()` on the client `ShoppingList`. Solution: make a thin `ListaHeader` client component that owns the button and `ShoppingList` exposes `closeSession` via a callback ref.

- [ ] **Step 1: Create `src/components/pages/lista/lista-header.tsx`** (new file — thin client wrapper for the clear button)

```tsx
'use client';
import { useRef, useEffect } from 'react';
import { Icon } from '@/components/atoms/icon';
import { ShoppingList } from './shopping-list';
import type { ShoppingItem } from '@/db/schema';

interface ListaHeaderProps {
  initialItems: ShoppingItem[];
  done: number;
  total: number;
  recurring: number;
}

export function ListaShell({ initialItems, done, total, recurring }: ListaHeaderProps) {
  const closeRef = useRef<(() => void) | null>(null);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lista de compras</h1>
          <div className="sub">
            {done}/{total} concluídos · {recurring} recorrentes
          </div>
        </div>
        <div className="right">
          <button className="btn ghost" onClick={() => closeRef.current?.()}>
            <Icon name="trash" size={14} /> Limpar marcados
          </button>
        </div>
      </div>
      <div className="lista-tabs">
        <a href="/lista" className="tab active">Lista</a>
        <a href="/lista/base" className="tab">Base</a>
        <a href="/lista/historico" className="tab">Histórico</a>
      </div>
      <ShoppingList
        initialItems={initialItems}
        onCloseSessionRef={fn => { closeRef.current = fn; }}
      />
    </>
  );
}
```

- [ ] **Step 2: Replace `src/app/lista/page.tsx`**

```tsx
import { db } from '@/db/client';
import { shoppingItems } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { ListaShell } from '@/components/pages/lista/lista-header';

export default function ListaPage() {
  const allItems = db.select().from(shoppingItems).orderBy(asc(shoppingItems.category)).all();
  const done = allItems.filter(i => i.isChecked).length;
  const recurring = allItems.filter(i => i.isRecurring).length;

  return (
    <ListaShell
      initialItems={allItems}
      done={done}
      total={allItems.length}
      recurring={recurring}
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/pages/lista/lista-header.tsx src/app/lista/page.tsx
git commit -m "feat(lista): wire Limpar marcados button + add sub-nav tabs to /lista"
```

---

### Task 11: Base list page (/lista/base)

**Files:**
- Create: `src/components/pages/lista/base-list.tsx`
- Create: `src/app/lista/base/page.tsx`

- [ ] **Step 1: Create `src/components/pages/lista/base-list.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { Icon } from '@/components/atoms/icon';
import type { BaseListItem } from '@/db/schema';

interface BaseListProps {
  initialItems: BaseListItem[];
}

const CATEGORIES = ['Hortifruti', 'Mercado', 'Limpeza', 'Outros'];

export function BaseList({ initialItems }: BaseListProps) {
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState('');
  const [draftCat, setDraftCat] = useState('Mercado');
  const [draftQty, setDraftQty] = useState(1);

  const addItem = async () => {
    const name = draft.trim();
    if (!name) return;
    const res = await fetch('/api/shopping/base', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category: draftCat, defaultQty: draftQty }),
    });
    const { id } = await res.json();
    setItems(xs => [...xs, {
      id, name, category: draftCat, defaultQty: draftQty,
      createdAt: Math.floor(Date.now() / 1000),
    }]);
    setDraft('');
    setDraftQty(1);
  };

  const removeItem = async (id: string) => {
    await fetch(`/api/shopping/base/${id}`, { method: 'DELETE' });
    setItems(xs => xs.filter(x => x.id !== id));
  };

  const addToActive = async (item: BaseListItem) => {
    await fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: item.name, category: item.category,
        qty: item.defaultQty, baseListItemId: item.id,
      }),
    });
  };

  return (
    <>
      <div className="new-input">
        <Icon name="plus" size={16} color="var(--accent)" />
        <input
          placeholder="Adicionar à lista base…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
        />
        <div className="qty-ctrl">
          <button type="button" onClick={() => setDraftQty(q => Math.max(1, q - 1))}>−</button>
          <span>{draftQty}</span>
          <button type="button" onClick={() => setDraftQty(q => q + 1)}>+</button>
        </div>
        <select
          value={draftCat}
          onChange={e => setDraftCat(e.target.value)}
          style={{
            background: 'var(--bg-3)', color: 'var(--text-1)',
            border: '1px solid var(--line)', borderRadius: 6,
            padding: '4px 8px', fontSize: 12,
          }}
        >
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button className="btn primary" onClick={addItem}>Adicionar</button>
      </div>

      {items.length === 0 && (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>
          Lista base vazia — adicione itens recorrentes acima.
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {items.map(item => (
          <div key={item.id} className="base-item">
            <span className="base-name">{item.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
              ×{item.defaultQty}
            </span>
            <span className="base-cat">{item.category}</span>
            <div className="base-actions">
              <button
                className="btn ghost"
                style={{ padding: '4px 8px', fontSize: 12 }}
                onClick={() => addToActive(item)}
                title="Adicionar à lista atual"
              >
                + lista
              </button>
              <button
                className="btn ghost"
                style={{ padding: '4px 8px', fontSize: 12, color: 'var(--danger)' }}
                onClick={() => removeItem(item.id)}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create `src/app/lista/base/page.tsx`**

```tsx
import { db } from '@/db/client';
import { baseListItems } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { BaseList } from '@/components/pages/lista/base-list';
import { Icon } from '@/components/atoms/icon';

export default function BaseListPage() {
  const items = db.select().from(baseListItems).orderBy(asc(baseListItems.category)).all();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lista base</h1>
          <div className="sub">{items.length} itens recorrentes</div>
        </div>
      </div>
      <div className="lista-tabs">
        <a href="/lista" className="tab">Lista</a>
        <a href="/lista/base" className="tab active">Base</a>
        <a href="/lista/historico" className="tab">Histórico</a>
      </div>
      <BaseList initialItems={items} />
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/pages/lista/base-list.tsx src/app/lista/base/page.tsx
git commit -m "feat(lista): add base list page with CRUD UI"
```

---

### Task 12: Histórico page (/lista/historico)

**Files:**
- Create: `src/components/pages/lista/historico.tsx`
- Create: `src/app/lista/historico/page.tsx`

- [ ] **Step 1: Create `src/components/pages/lista/historico.tsx`**

```tsx
'use client';
import { useState } from 'react';
import type { ShoppingSession, ShoppingSessionItem } from '@/db/schema';
import type { FrequencyEntry } from '@/lib/shopping-frequency';

interface HistoricoProps {
  sessions: ShoppingSession[];
  frequency: FrequencyEntry[];
  sessionItemsMap: Record<string, ShoppingSessionItem[]>;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDaysAgo(ts: number): string {
  const days = Math.floor((Date.now() / 1000 - ts) / 86400);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `${days} dias atrás`;
}

export function Historico({ sessions, frequency, sessionItemsMap }: HistoricoProps) {
  const [tab, setTab] = useState<'sessions' | 'frequency'>('sessions');
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={`btn${tab === 'sessions' ? ' primary' : ' ghost'}`}
          onClick={() => setTab('sessions')}
        >
          Sessões
        </button>
        <button
          className={`btn${tab === 'frequency' ? ' primary' : ' ghost'}`}
          onClick={() => setTab('frequency')}
        >
          Por item
        </button>
      </div>

      {tab === 'sessions' && (
        <>
          {sessions.length === 0 && (
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>
              Nenhuma compra finalizada ainda.
            </div>
          )}
          {sessions.map(session => {
            const isOpen = expanded === session.id;
            const sItems = sessionItemsMap[session.id] ?? [];
            return (
              <div key={session.id} className="hist-session">
                <div className="hist-head" onClick={() => setExpanded(isOpen ? null : session.id)}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{formatDate(session.completedAt)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      {session.totalChecked} de {session.totalItems} itens comprados
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-3)', fontSize: 18 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div className="hist-body">
                    {sItems.map(item => (
                      <div key={item.id} className="hist-item">
                        <span style={{ flex: 1 }}>{item.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>
                          ×{item.qty}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>
                          {item.category}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {tab === 'frequency' && (
        <>
          {frequency.length === 0 && (
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>
              Nenhum dado de frequência ainda.
            </div>
          )}
          {frequency.map((entry, i) => (
            <div key={entry.name} className="freq-item">
              <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12, width: 24 }}>
                {i + 1}
              </span>
              <span className="freq-name">{entry.name}</span>
              <span className="freq-last">{formatDaysAgo(entry.lastBoughtAt)}</span>
              <span className="freq-count">{entry.count}×</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create `src/app/lista/historico/page.tsx`**

Loads all data server-side (no client fetch on load) then passes to client component.

```tsx
import { db } from '@/db/client';
import { shoppingSessions, shoppingSessionItems } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { Historico } from '@/components/pages/lista/historico';
import { buildFrequencyRanking } from '@/lib/shopping-frequency';
import type { ShoppingSessionItem } from '@/db/schema';

export default function HistoricoPage() {
  const sessions = db.select().from(shoppingSessions)
    .orderBy(desc(shoppingSessions.completedAt)).all();

  const allSessionItems = db.select().from(shoppingSessionItems).all();

  // Group session items by sessionId for O(1) lookup in client component
  const sessionItemsMap: Record<string, ShoppingSessionItem[]> = {};
  for (const item of allSessionItems) {
    if (!sessionItemsMap[item.sessionId]) sessionItemsMap[item.sessionId] = [];
    sessionItemsMap[item.sessionId].push(item);
  }

  // Build frequency ranking server-side using pure fn
  const sessionMap = new Map(sessions.map(s => [s.id, s.completedAt]));
  const rows = allSessionItems.map(i => ({
    name: i.name,
    category: i.category,
    completedAt: sessionMap.get(i.sessionId) ?? 0,
  }));
  const frequency = buildFrequencyRanking(rows);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Histórico</h1>
          <div className="sub">{sessions.length} compras finalizadas</div>
        </div>
      </div>
      <div className="lista-tabs">
        <a href="/lista" className="tab">Lista</a>
        <a href="/lista/base" className="tab">Base</a>
        <a href="/lista/historico" className="tab active">Histórico</a>
      </div>
      <Historico
        sessions={sessions}
        frequency={frequency}
        sessionItemsMap={sessionItemsMap}
      />
    </>
  );
}
```

- [ ] **Step 3: Run all tests to confirm no regressions**

Run: `npm run test:run`

Expected: All tests pass (6 frequency tests + existing auto-detect + fmt tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/pages/lista/historico.tsx src/app/lista/historico/page.tsx
git commit -m "feat(lista): add histórico page with sessions view and per-item frequency ranking"
```

---

## Done

All 12 tasks complete. The shopping list now has:
- Item quantities (inline +/- controls)
- Base list (/lista/base) with CRUD
- Session close flow: "Limpar marcados" → save history → "Iniciar nova compra?" modal
- Histórico (/lista/historico): sessions view + per-item frequency ranking
- All data server-loaded, client state managed locally
