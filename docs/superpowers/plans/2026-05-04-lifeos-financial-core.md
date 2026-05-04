# Life OS — Financial Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first personal finance OS as a Next.js 14 app with SQLite storage, Pluggy bank API integration, and the pixel-perfect dark UI from the approved mockup at `design-bundle/lifeos/project/`.

**Architecture:** Next.js 14 App Router. Server Components fetch data directly from SQLite via Drizzle ORM. Client Components handle interactivity and call API routes for mutations. Pluggy SDK runs server-side only — credentials never reach the browser.

**Tech Stack:** Next.js 14, TypeScript, Drizzle ORM, better-sqlite3, pluggy-sdk, Vitest

---

## File Map

```
lifeos/
├── .env.local                                  # credentials (gitignored)
├── .gitignore
├── drizzle.config.ts
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
├── package.json
├── src/
│   ├── app/
│   │   ├── globals.css                         # full design system from mockup
│   │   ├── layout.tsx                          # root layout: fonts + shell + settings provider
│   │   ├── page.tsx                            # home (Server Component)
│   │   ├── financas/page.tsx                   # finanças (Server Component)
│   │   ├── contas/page.tsx                     # contas (Server Component)
│   │   ├── assinaturas/page.tsx                # assinaturas (Server Component)
│   │   ├── lista/page.tsx                      # lista (Server Component)
│   │   └── api/
│   │       ├── sync/route.ts
│   │       ├── accounts/route.ts
│   │       ├── transactions/route.ts
│   │       ├── bills/route.ts
│   │       ├── bills/[id]/route.ts
│   │       ├── subscriptions/route.ts
│   │       ├── subscriptions/[id]/route.ts
│   │       ├── shopping/route.ts
│   │       └── shopping/[id]/route.ts
│   ├── components/
│   │   ├── shell/
│   │   │   ├── sidebar.tsx                     # 'use client' — usePathname for active state
│   │   │   └── topbar.tsx                      # 'use client' — sync button, privacy toggle
│   │   ├── atoms/
│   │   │   ├── icon.tsx                        # SVG icon set (all from mockup)
│   │   │   ├── tag.tsx                         # colored badge component
│   │   │   └── spark-bars.tsx                  # mini bar chart
│   │   └── pages/
│   │       ├── home/
│   │       │   ├── kpi-grid.tsx                # 4 clickable KPI cards
│   │       │   ├── recent-activity.tsx         # transaction list (last 6)
│   │       │   ├── calendar-strip.tsx          # 7-day strip with bill pips
│   │       │   └── category-allocation.tsx     # progress bars by category
│   │       ├── financas/
│   │       │   ├── account-chips.tsx           # bank account chips (Server Component)
│   │       │   └── transactions-table.tsx      # 'use client' — filter chips + table
│   │       ├── contas/
│   │       │   └── bills-list.tsx              # 'use client' — tabs, mark paid
│   │       ├── assinaturas/
│   │       │   └── subs-page.tsx               # 'use client' — KPIs + filter + grid
│   │       └── lista/
│   │           └── shopping-list.tsx           # 'use client' — add item, check off
│   ├── db/
│   │   ├── schema.ts                           # Drizzle table definitions + type exports
│   │   └── client.ts                           # better-sqlite3 singleton
│   └── lib/
│       ├── fmt.ts                              # BRL currency formatter
│       ├── dates.ts                            # daysUntilDue, dayLabel, billTone
│       ├── bank-colors.ts                      # bank name → hex color map
│       ├── auto-detect.ts                      # pure detection fns + DB-writing fns
│       ├── pluggy.ts                           # Pluggy SDK wrapper + syncPluggy()
│       └── settings.tsx                        # 'use client' — SettingsContext + provider
├── src/__tests__/
│   ├── fmt.test.ts
│   └── auto-detect.test.ts
```

---

## Task 1: Scaffold project

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `drizzle.config.ts`
- Create: `.gitignore`
- Create: `.env.local`
- Create: `src/app/globals.css` (empty for now)
- Create: `src/app/layout.tsx` (minimal)
- Create: `src/app/page.tsx` (placeholder)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "lifeos",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "test:run": "vitest run",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "drizzle-orm": "^0.31.4",
    "better-sqlite3": "^9.6.0",
    "pluggy-sdk": "^3.1.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "drizzle-kit": "^0.22.8",
    "typescript": "^5",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
};

export default config;
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 5: Create `drizzle.config.ts`**

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './lifeos.db',
  },
} satisfies Config;
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules/
.next/
lifeos.db
.env.local
design-bundle/
.superpowers/
```

- [ ] **Step 7: Create `.env.local`**

```env
PLUGGY_CLIENT_ID=<your-client-id>
PLUGGY_CLIENT_SECRET=<your-client-secret>
PLUGGY_ITEM_IDS=
```

- [ ] **Step 8: Create minimal `src/app/globals.css`** (empty file — will be populated in Task 2)

```css
/* populated in Task 2 */
```

- [ ] **Step 9: Create minimal `src/app/layout.tsx`**

```typescript
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 10: Create placeholder `src/app/page.tsx`**

```typescript
export default function HomePage() {
  return <p style={{ color: 'white', padding: 20 }}>Life OS — scaffolding ok</p>;
}
```

- [ ] **Step 11: Run `npm install`**

```powershell
npm install
```

Expected: packages install without errors. If `better-sqlite3` fails with a build error on Windows, run:
```powershell
npm install --global windows-build-tools
npm install
```

- [ ] **Step 12: Start dev server and verify**

```powershell
npm run dev
```

Open `http://localhost:3000`. Expected: white text "Life OS — scaffolding ok" on black background.

- [ ] **Step 13: Commit**

```bash
git add package.json next.config.ts tsconfig.json vitest.config.ts drizzle.config.ts .gitignore .env.local src/
git commit -m "chore: scaffold Next.js 14 project with TypeScript and Vitest"
```

---

## Task 2: Design system

**Files:**
- Modify: `src/app/globals.css` (replace placeholder with full design system)

- [ ] **Step 1: Replace `src/app/globals.css` with full design system**

Copy the contents verbatim from `design-bundle/lifeos/project/styles.css`. The file is ~700 lines and contains all tokens, layout, card, button, nav, table, tag, chip, bill, subscription, shopping, and calendar styles.

```css
/* Life OS — design tokens */
:root {
  --bg-0: #0b0b14;
  --bg-1: #11111d;
  --bg-2: #161624;
  --bg-3: #1c1c2e;
  --line: #232339;
  --line-2: #2d2d4a;
  --text-0: #f1f1f7;
  --text-1: #c4c4d6;
  --text-2: #8a8aa0;
  --text-3: #5b5b75;

  --accent: #a78bfa;
  --accent-soft: #a78bfa1f;
  --good: #5fd39a;
  --warn: #f5b754;
  --danger: #f47272;
  --info: #6ec1f0;

  --radius: 10px;
  --radius-sm: 6px;
  --shadow: 0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.35);

  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}

* { box-sizing: border-box; }

html, body {
  margin: 0; padding: 0;
  background: var(--bg-0);
  color: var(--text-0);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}

body[data-density="compact"] { font-size: 13px; }
body[data-density="cozy"]    { font-size: 14px; }
body[data-density="comfortable"] { font-size: 15px; }

body::before {
  content: '';
  position: fixed; inset: 0;
  background:
    radial-gradient(900px 500px at 12% -10%, color-mix(in oklch, var(--accent) 10%, transparent), transparent 60%),
    radial-gradient(700px 400px at 110% 110%, color-mix(in oklch, var(--accent) 6%, transparent), transparent 60%);
  pointer-events: none;
  z-index: 0;
}

#root, main { position: relative; z-index: 1; }
```

Then append the remaining CSS from `design-bundle/lifeos/project/styles.css` starting from line 61 (`.app { ... }`) through the end of the file. Open the reference file and copy all remaining rules verbatim.

- [ ] **Step 2: Update `src/app/layout.tsx` to load Google Fonts**

```typescript
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Life OS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body data-density="cozy" data-privacy="off">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify fonts load**

Open `http://localhost:3000`. The placeholder text should use Inter font.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: add full design system (tokens, layout, components CSS)"
```

---

## Task 3: DB schema and client

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/client.ts`

- [ ] **Step 1: Create `src/db/schema.ts`**

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id:         text('id').primaryKey(),
  pluggyId:   text('pluggy_id').unique(),
  name:       text('name').notNull(),
  bank:       text('bank').notNull(),
  type:       text('type').notNull(),           // 'checking' | 'credit'
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
  type:        text('type').notNull(),           // 'debit' | 'credit'
  category:    text('category').notNull().default(''),
  date:        text('date').notNull(),           // YYYY-MM-DD
  createdAt:   integer('created_at').notNull(),
});

export const bills = sqliteTable('bills', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  amount:      real('amount'),                   // nullable — auto-detected may be unknown
  dueDay:      integer('due_day').notNull(),     // 1-31
  category:    text('category').notNull(),
  source:      text('source').notNull().default('manual'), // 'manual' | 'auto'
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
  category:   text('category').notNull(),       // 'Streaming' | 'IA' | 'Outros'
  source:     text('source').notNull().default('manual'),
  alertDays:  integer('alert_days').notNull().default(3),
  isActive:   integer('is_active').notNull().default(1),
  createdAt:  integer('created_at').notNull(),
});

export const shoppingItems = sqliteTable('shopping_items', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  category:    text('category').notNull(),
  isRecurring: integer('is_recurring').notNull().default(0),
  isChecked:   integer('is_checked').notNull().default(0),
  createdAt:   integer('created_at').notNull(),
});

export const syncLog = sqliteTable('sync_log', {
  id:                  text('id').primaryKey(),
  status:              text('status').notNull(),  // 'ok' | 'error'
  accountsSynced:      integer('accounts_synced').notNull().default(0),
  transactionsSynced:  integer('transactions_synced').notNull().default(0),
  errorMsg:            text('error_msg'),
  syncedAt:            integer('synced_at').notNull(),
});

// Inferred types for use throughout the app
export type Account      = typeof accounts.$inferSelect;
export type Transaction  = typeof transactions.$inferSelect;
export type Bill         = typeof bills.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type ShoppingItem = typeof shoppingItems.$inferSelect;
export type SyncLogEntry = typeof syncLog.$inferSelect;
```

- [ ] **Step 2: Create `src/db/client.ts`**

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'lifeos.db');

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
```

- [ ] **Step 3: Push schema to SQLite**

```powershell
npm run db:push
```

Expected output: `[✓] Changes applied` and `lifeos.db` created in project root.

- [ ] **Step 4: Verify DB created**

```powershell
ls lifeos.db
```

Expected: file exists with non-zero size.

- [ ] **Step 5: Commit**

```bash
git add src/db/ drizzle.config.ts
git commit -m "feat: add Drizzle schema (6 tables) and SQLite client"
```

---

## Task 4: Utility libraries (TDD)

**Files:**
- Create: `src/lib/fmt.ts`
- Create: `src/lib/dates.ts`
- Create: `src/lib/bank-colors.ts`
- Create: `src/__tests__/fmt.test.ts`

- [ ] **Step 1: Write failing tests for `fmt`**

Create `src/__tests__/fmt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { fmt } from '@/lib/fmt';

describe('fmt', () => {
  it('formats positive BRL amount', () => {
    expect(fmt(1234.56)).toBe('R$ 1.234,56');
  });

  it('formats negative amount with minus sign', () => {
    expect(fmt(-45.9)).toBe('-R$ 45,90');
  });

  it('formats zero', () => {
    expect(fmt(0)).toBe('R$ 0,00');
  });

  it('adds + sign when signed=true and value positive', () => {
    expect(fmt(5000, { signed: true })).toBe('+R$ 5.000,00');
  });

  it('keeps minus when signed=true and value negative', () => {
    expect(fmt(-210.34, { signed: true })).toBe('-R$ 210,34');
  });

  it('returns em dash for NaN', () => {
    expect(fmt(NaN)).toBe('—');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
npm run test:run
```

Expected: `Cannot find module '@/lib/fmt'`

- [ ] **Step 3: Implement `src/lib/fmt.ts`**

```typescript
export function fmt(v: number, opts: { signed?: boolean } = {}): string {
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const s = abs.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (opts.signed && n > 0 ? '+' : sign) + 'R$ ' + s;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
npm run test:run
```

Expected: all 6 `fmt` tests pass.

- [ ] **Step 5: Create `src/lib/dates.ts`**

```typescript
export function daysUntilDue(dueDay: number): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let due = new Date(year, month, dueDay);
  if (due.getTime() <= now.getTime()) {
    due = new Date(year, month + 1, dueDay);
  }

  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function billTone(dueDay: number, isPaid: boolean): 'ok' | 'urgent' | 'soon' | 'future' {
  if (isPaid) return 'ok';
  const d = daysUntilDue(dueDay);
  if (d <= 3) return 'urgent';
  if (d <= 7) return 'soon';
  return 'future';
}

export function dayLabel(date: string): string {
  const dt = new Date(date + 'T12:00:00');
  return dt
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '');
}

export function monthYear(): string {
  return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
```

- [ ] **Step 6: Create `src/lib/bank-colors.ts`**

```typescript
export const BANK_COLORS: Record<string, string> = {
  Nubank:      '#a78bfa',
  Inter:       '#f97373',
  Bradesco:    '#f59e0b',
  Itaú:        '#f97316',
  'Banco do Brasil': '#fbbf24',
  Santander:   '#ef4444',
  Caixa:       '#3b82f6',
  XP:          '#22c55e',
  C6:          '#64748b',
  Neon:        '#06b6d4',
  PicPay:      '#4ade80',
};

export function bankColor(bank: string): string {
  return BANK_COLORS[bank] ?? '#a78bfa';
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/fmt.ts src/lib/dates.ts src/lib/bank-colors.ts src/__tests__/fmt.test.ts
git commit -m "feat: add fmt, dates, bank-colors utilities with tests"
```

---

## Task 5: Auto-detect library (TDD)

**Files:**
- Create: `src/__tests__/auto-detect.test.ts`
- Create: `src/lib/auto-detect.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/auto-detect.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findSubscriptionCandidates, findBillCandidates } from '@/lib/auto-detect';
import type { Transaction } from '@/db/schema';

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: 'id',
  pluggyId: 'pid',
  accountId: 'acct',
  description: 'Test',
  amount: -50,
  type: 'debit',
  category: '',
  date: '2026-01-15',
  createdAt: 0,
  ...overrides,
});

describe('findSubscriptionCandidates', () => {
  it('detects Netflix by keyword', () => {
    const results = findSubscriptionCandidates([
      tx({ description: 'Netflix Monthly', amount: -55.9, date: '2026-04-12' }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Netflix');
    expect(results[0].category).toBe('Streaming');
    expect(results[0].billingDay).toBe(12);
    expect(results[0].amount).toBeCloseTo(55.9);
  });

  it('detects ChatGPT via openai keyword', () => {
    const results = findSubscriptionCandidates([
      tx({ description: 'OPENAI *CHATGPT PLUS', amount: -107.4, date: '2026-04-18' }),
    ]);
    expect(results[0].name).toBe('ChatGPT Plus');
    expect(results[0].category).toBe('IA');
    expect(results[0].billingDay).toBe(18);
  });

  it('ignores credit transactions', () => {
    const results = findSubscriptionCandidates([
      tx({ description: 'Netflix refund', amount: +55.9 }),
    ]);
    expect(results).toHaveLength(0);
  });

  it('returns empty when no keywords match', () => {
    const results = findSubscriptionCandidates([
      tx({ description: 'Padaria do Zé', amount: -18 }),
    ]);
    expect(results).toHaveLength(0);
  });

  it('does not create duplicate candidates for same keyword', () => {
    const results = findSubscriptionCandidates([
      tx({ description: 'Spotify Familia', amount: -21.9, date: '2026-03-25' }),
      tx({ description: 'Spotify Familia', amount: -21.9, date: '2026-04-25' }),
    ]);
    expect(results).toHaveLength(1);
  });
});

describe('findBillCandidates', () => {
  it('detects recurring debit across 2+ months as bill candidate', () => {
    const results = findBillCandidates([
      tx({ description: 'Conta Luz CEMIG', amount: -120, date: '2026-03-05' }),
      tx({ description: 'Conta Luz CEMIG', amount: -115, date: '2026-04-06' }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Conta Luz CEMIG');
    expect(results[0].dueDay).toBe(5);
    expect(results[0].needsReview).toBe(1);
  });

  it('ignores transactions in same month only', () => {
    const results = findBillCandidates([
      tx({ description: 'Loja ABC', amount: -50, date: '2026-04-01' }),
      tx({ description: 'Loja ABC', amount: -50, date: '2026-04-15' }),
    ]);
    expect(results).toHaveLength(0);
  });

  it('ignores single occurrences', () => {
    const results = findBillCandidates([
      tx({ description: 'Compra única', amount: -200 }),
    ]);
    expect(results).toHaveLength(0);
  });

  it('averages amount across occurrences', () => {
    const results = findBillCandidates([
      tx({ description: 'Água SABESP', amount: -65, date: '2026-02-10' }),
      tx({ description: 'Água SABESP', amount: -70, date: '2026-03-10' }),
      tx({ description: 'Água SABESP', amount: -68, date: '2026-04-11' }),
    ]);
    expect(results[0].amount).toBeCloseTo(67.67, 1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
npm run test:run
```

Expected: `Cannot find module '@/lib/auto-detect'`

- [ ] **Step 3: Implement `src/lib/auto-detect.ts`**

```typescript
import type { Transaction } from '@/db/schema';

export interface SubscriptionCandidate {
  name: string;
  category: string;
  amount: number;
  billingDay: number;
}

export interface BillCandidate {
  name: string;
  amount: number;
  dueDay: number;
  needsReview: 1;
}

const KEYWORDS: Record<string, { name: string; category: string }> = {
  netflix:        { name: 'Netflix',        category: 'Streaming' },
  spotify:        { name: 'Spotify',        category: 'Streaming' },
  'disney+':      { name: 'Disney+',        category: 'Streaming' },
  'disney plus':  { name: 'Disney+',        category: 'Streaming' },
  chatgpt:        { name: 'ChatGPT Plus',   category: 'IA' },
  openai:         { name: 'ChatGPT Plus',   category: 'IA' },
  cursor:         { name: 'Cursor Pro',     category: 'IA' },
  anthropic:      { name: 'Claude',         category: 'IA' },
  icloud:         { name: 'iCloud',         category: 'Outros' },
  'apple storage':{ name: 'iCloud',         category: 'Outros' },
  notion:         { name: 'Notion',         category: 'Outros' },
  github:         { name: 'GitHub',         category: 'Outros' },
  'amazon prime': { name: 'Amazon Prime',   category: 'Streaming' },
  'youtube premium': { name: 'YouTube Premium', category: 'Streaming' },
};

export function findSubscriptionCandidates(txs: Transaction[]): SubscriptionCandidate[] {
  const debits = txs.filter(t => t.amount < 0);
  const seen = new Set<string>();
  const candidates: SubscriptionCandidate[] = [];

  for (const tx of debits) {
    const lower = tx.description.toLowerCase();
    for (const [keyword, meta] of Object.entries(KEYWORDS)) {
      if (lower.includes(keyword) && !seen.has(meta.name)) {
        seen.add(meta.name);
        candidates.push({
          name: meta.name,
          category: meta.category,
          amount: Math.abs(tx.amount),
          billingDay: new Date(tx.date + 'T12:00:00').getDate(),
        });
        break;
      }
    }
  }

  return candidates;
}

export function findBillCandidates(txs: Transaction[]): BillCandidate[] {
  const debits = txs.filter(t => t.amount < 0);
  const groups = new Map<string, Transaction[]>();

  for (const tx of debits) {
    const key = tx.description.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const candidates: BillCandidate[] = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    const months = new Set(group.map(t => t.date.slice(0, 7)));
    if (months.size < 2) continue;

    const days = group.map(t => new Date(t.date + 'T12:00:00').getDate());
    const freq = new Map<number, number>();
    for (const d of days) freq.set(d, (freq.get(d) ?? 0) + 1);
    const dueDay = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const avgAmount =
      Math.round((group.reduce((s, t) => s + Math.abs(t.amount), 0) / group.length) * 100) / 100;

    candidates.push({
      name: group[0].description,
      amount: avgAmount,
      dueDay,
      needsReview: 1,
    });
  }

  return candidates;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```powershell
npm run test:run
```

Expected: all tests pass (6 fmt + 9 auto-detect).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auto-detect.ts src/__tests__/auto-detect.test.ts
git commit -m "feat: add bill/subscription auto-detection with tests (TDD)"
```

---

## Task 6: Pluggy sync library

**Files:**
- Create: `src/lib/pluggy.ts`

- [ ] **Step 1: Create `src/lib/pluggy.ts`**

```typescript
import { PluggyClient } from 'pluggy-sdk';
import { db } from '@/db/client';
import { accounts, transactions, bills, subscriptions, syncLog } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { bankColor } from './bank-colors';
import { findBillCandidates, findSubscriptionCandidates } from './auto-detect';

function makeClient() {
  return new PluggyClient({
    clientId: process.env.PLUGGY_CLIENT_ID!,
    clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
  });
}

export interface SyncResult {
  accountsSynced: number;
  transactionsSynced: number;
  errors: string[];
}

export async function syncPluggy(): Promise<SyncResult> {
  const itemIds = (process.env.PLUGGY_ITEM_IDS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (itemIds.length === 0) {
    throw new Error('PLUGGY_ITEM_IDS is not configured in .env.local');
  }

  const client = makeClient();
  const now = Math.floor(Date.now() / 1000);
  const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const toDate = new Date().toISOString().split('T')[0];

  let accountsSynced = 0;
  let transactionsSynced = 0;
  const errors: string[] = [];

  for (const itemId of itemIds) {
    try {
      const { results: pluggyAccounts } = await client.fetchAccounts(itemId);

      for (const pa of pluggyAccounts) {
        const bank = pa.institutionNumber ?? pa.name.split(' ')[0];
        const type = pa.type === 'CREDIT' ? 'credit' : 'checking';
        const last4 = (pa.number ?? '').slice(-4);
        const color = bankColor(bank);

        const existing = db.select().from(accounts)
          .where(eq(accounts.pluggyId, pa.id)).get();

        if (existing) {
          db.update(accounts)
            .set({ balance: pa.balance, updatedAt: now })
            .where(eq(accounts.pluggyId, pa.id))
            .run();
        } else {
          db.insert(accounts).values({
            id: randomUUID(),
            pluggyId: pa.id,
            name: pa.name,
            bank,
            type,
            balance: pa.balance,
            color,
            last4: last4 || null,
            limit: (pa as any).creditData?.creditLimit ?? null,
            updatedAt: now,
          }).run();
        }
        accountsSynced++;

        const acct = db.select().from(accounts)
          .where(eq(accounts.pluggyId, pa.id)).get()!;

        const { results: pluggyTxs } = await client.fetchTransactions(pa.id, {
          from: fromDate,
          to: toDate,
          pageSize: 500,
        });

        for (const pt of pluggyTxs) {
          const exists = db.select().from(transactions)
            .where(eq(transactions.pluggyId, pt.id)).get();

          if (!exists) {
            const amount = pt.type === 'DEBIT'
              ? -Math.abs(pt.amount)
              : Math.abs(pt.amount);

            db.insert(transactions).values({
              id: randomUUID(),
              pluggyId: pt.id,
              accountId: acct.id,
              description: pt.description,
              amount,
              type: pt.type.toLowerCase(),
              category: pt.category ?? '',
              date: (pt.date as string).split('T')[0],
              createdAt: now,
            }).run();
            transactionsSynced++;
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Item ${itemId}: ${msg}`);
    }
  }

  // Auto-detection pass
  const allTxs = db.select().from(transactions).all();

  const subCandidates = findSubscriptionCandidates(allTxs);
  for (const c of subCandidates) {
    const exists = db.select().from(subscriptions).all()
      .find(s => s.name.toLowerCase() === c.name.toLowerCase());
    if (!exists) {
      db.insert(subscriptions).values({
        id: randomUUID(),
        name: c.name,
        amount: c.amount,
        billingDay: c.billingDay,
        category: c.category,
        source: 'auto',
        alertDays: 3,
        isActive: 1,
        createdAt: now,
      }).run();
    }
  }

  const billCandidates = findBillCandidates(allTxs);
  for (const c of billCandidates) {
    const exists = db.select().from(bills).all()
      .find(b => b.name.toLowerCase() === c.name.toLowerCase());
    if (!exists) {
      db.insert(bills).values({
        id: randomUUID(),
        name: c.name,
        amount: c.amount,
        dueDay: c.dueDay,
        category: 'Outros',
        source: 'auto',
        isPaid: 0,
        needsReview: 1,
        createdAt: now,
      }).run();
    }
  }

  db.insert(syncLog).values({
    id: randomUUID(),
    status: errors.length > 0 ? 'error' : 'ok',
    accountsSynced,
    transactionsSynced,
    errorMsg: errors.length > 0 ? errors.join('; ') : null,
    syncedAt: now,
  }).run();

  return { accountsSynced, transactionsSynced, errors };
}
```

> **Note:** The Pluggy SDK field names (`pa.institutionNumber`, `pa.creditData`) may differ from the actual SDK version. Verify against `node_modules/pluggy-sdk/dist/index.d.ts` after install and adjust accordingly.

- [ ] **Step 2: Commit**

```bash
git add src/lib/pluggy.ts
git commit -m "feat: add Pluggy SDK sync wrapper with auto-detect integration"
```

---

## Task 7: API routes

**Files:**
- Create: `src/app/api/sync/route.ts`
- Create: `src/app/api/accounts/route.ts`
- Create: `src/app/api/transactions/route.ts`
- Create: `src/app/api/bills/route.ts`
- Create: `src/app/api/bills/[id]/route.ts`
- Create: `src/app/api/subscriptions/route.ts`
- Create: `src/app/api/subscriptions/[id]/route.ts`
- Create: `src/app/api/shopping/route.ts`
- Create: `src/app/api/shopping/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/sync/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { syncPluggy } from '@/lib/pluggy';

export async function POST() {
  try {
    const result = await syncPluggy();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `src/app/api/accounts/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { accounts } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const result = db.select().from(accounts).orderBy(desc(accounts.updatedAt)).all();
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Create `src/app/api/transactions/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { desc, eq, and } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const accountId = searchParams.get('accountId');

  let query = db.select().from(transactions).$dynamic();

  if (category && category !== 'all') {
    query = query.where(eq(transactions.category, category));
  }
  if (accountId && accountId !== 'all') {
    query = query.where(eq(transactions.accountId, accountId));
  }

  const result = query.orderBy(desc(transactions.date)).all();
  return NextResponse.json(result);
}
```

- [ ] **Step 4: Create `src/app/api/bills/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { bills } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function GET() {
  const result = db.select().from(bills).orderBy(asc(bills.dueDay)).all();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.insert(bills).values({
    id,
    name: body.name,
    amount: body.amount ?? null,
    dueDay: body.dueDay,
    category: body.category ?? 'Outros',
    source: 'manual',
    isPaid: 0,
    needsReview: 0,
    createdAt: now,
  }).run();

  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 5: Create `src/app/api/bills/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { bills } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Params { params: { id: string } }

export async function PATCH(request: Request, { params }: Params) {
  const body = await request.json();
  const now = Math.floor(Date.now() / 1000);

  const updates: Partial<typeof bills.$inferInsert> = {};
  if ('isPaid' in body) {
    updates.isPaid = body.isPaid ? 1 : 0;
    updates.paidAt = body.isPaid ? now : null;
  }
  if ('name' in body) updates.name = body.name;
  if ('amount' in body) updates.amount = body.amount;
  if ('dueDay' in body) updates.dueDay = body.dueDay;
  if ('needsReview' in body) updates.needsReview = body.needsReview ? 1 : 0;

  db.update(bills).set(updates).where(eq(bills.id, params.id)).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
  db.delete(bills).where(eq(bills.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Create `src/app/api/subscriptions/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { subscriptions } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function GET() {
  const result = db.select().from(subscriptions).orderBy(asc(subscriptions.billingDay)).all();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.insert(subscriptions).values({
    id,
    name: body.name,
    amount: body.amount,
    billingDay: body.billingDay,
    category: body.category ?? 'Outros',
    source: 'manual',
    alertDays: body.alertDays ?? 3,
    isActive: 1,
    createdAt: now,
  }).run();

  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 7: Create `src/app/api/subscriptions/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { subscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Params { params: { id: string } }

export async function PATCH(request: Request, { params }: Params) {
  const body = await request.json();
  const updates: Partial<typeof subscriptions.$inferInsert> = {};
  if ('isActive' in body) updates.isActive = body.isActive ? 1 : 0;
  if ('amount' in body) updates.amount = body.amount;
  if ('billingDay' in body) updates.billingDay = body.billingDay;
  if ('name' in body) updates.name = body.name;

  db.update(subscriptions).set(updates).where(eq(subscriptions.id, params.id)).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
  db.delete(subscriptions).where(eq(subscriptions.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: Create `src/app/api/shopping/route.ts`**

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
    isRecurring: body.isRecurring ? 1 : 0,
    isChecked: 0,
    createdAt: now,
  }).run();

  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 9: Create `src/app/api/shopping/[id]/route.ts`**

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

- [ ] **Step 10: Verify API routes with curl**

```powershell
# In a second terminal while npm run dev is running:
curl http://localhost:3000/api/bills
```

Expected: `[]` (empty array — no bills yet).

```powershell
curl -X POST http://localhost:3000/api/bills -H "Content-Type: application/json" -d '{\"name\":\"Luz\",\"amount\":120,\"dueDay\":5,\"category\":\"Moradia\"}'
curl http://localhost:3000/api/bills
```

Expected: array with the created bill.

- [ ] **Step 11: Commit**

```bash
git add src/app/api/
git commit -m "feat: add all CRUD API routes (sync, bills, subscriptions, shopping)"
```

---

## Task 8: Atom components

**Files:**
- Create: `src/components/atoms/icon.tsx`
- Create: `src/components/atoms/tag.tsx`
- Create: `src/components/atoms/spark-bars.tsx`

- [ ] **Step 1: Create `src/components/atoms/icon.tsx`**

```typescript
interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 16, color = 'currentColor' }: IconProps) {
  const s = { stroke: color, fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  const paths: Record<string, React.ReactNode> = {
    home:      <><path d="M3 10.5L12 3l9 7.5" {...s} /><path d="M5 9.5V20h14V9.5" {...s} /></>,
    wallet:    <><rect x="3" y="6" width="18" height="13" rx="2" {...s} /><path d="M3 10h18" {...s} /><circle cx="17" cy="14.5" r="1.2" fill={color} /></>,
    calendar:  <><rect x="3" y="5" width="18" height="16" rx="2" {...s} /><path d="M3 9h18M8 3v4M16 3v4" {...s} /></>,
    repeat:    <><path d="M4 9V7a2 2 0 0 1 2-2h11l-2-2M20 15v2a2 2 0 0 1-2 2H7l2 2" {...s} /></>,
    cart:      <><path d="M3 4h2l2.4 11.5a2 2 0 0 0 2 1.5h7.6a2 2 0 0 0 2-1.6L21 8H6" {...s} /><circle cx="9" cy="20" r="1.2" {...s} /><circle cx="17" cy="20" r="1.2" {...s} /></>,
    sync:      <><path d="M4 12a8 8 0 0 1 13.5-5.5L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.5 5.5L4 15M4 20v-5h5" {...s} /></>,
    plus:      <><path d="M12 5v14M5 12h14" {...s} /></>,
    search:    <><circle cx="11" cy="11" r="6" {...s} /><path d="M16 16l4 4" {...s} /></>,
    bell:      <><path d="M6 16h12l-1.5-2v-4a4.5 4.5 0 0 0-9 0v4L6 16z" {...s} /><path d="M10 19a2 2 0 0 0 4 0" {...s} /></>,
    eye:       <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" {...s} /><circle cx="12" cy="12" r="3" {...s} /></>,
    eyeOff:    <><path d="M3 3l18 18" {...s} /><path d="M10.6 6.1A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6s-1 1.7-3 3.4M6.5 7.5C3.7 9.4 2 12 2 12s3.5 6 10 6c1.5 0 2.8-.3 4-.8" {...s} /></>,
    arrowDown: <><path d="M12 5v14M5 12l7 7 7-7" {...s} /></>,
    arrowUp:   <><path d="M12 19V5M5 12l7-7 7 7" {...s} /></>,
    check:     <><path d="M5 12l5 5 9-11" {...s} /></>,
    filter:    <><path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" {...s} /></>,
    chevron:   <><path d="M9 6l6 6-6 6" {...s} /></>,
    edit:      <><path d="M4 20h4l10-10-4-4L4 16v4z" {...s} /><path d="M14 6l4 4" {...s} /></>,
    trash:     <><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" {...s} /></>,
    bot:       <><rect x="4" y="8" width="16" height="11" rx="2" {...s} /><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6" {...s} /></>,
    download:  <><path d="M12 4v12M6 12l6 6 6-6M4 20h16" {...s} /></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0 }}>
      {paths[name]}
    </svg>
  );
}
```

- [ ] **Step 2: Create `src/components/atoms/tag.tsx`**

```typescript
import { Icon } from './icon';

type Tone = 'default' | 'accent' | 'good' | 'warn' | 'danger' | 'info';

interface TagProps {
  tone?: Tone;
  icon?: string;
  children: React.ReactNode;
}

export function Tag({ tone = 'default', icon, children }: TagProps) {
  return (
    <span className={`tag${tone !== 'default' ? ` ${tone}` : ''}`}>
      {icon && <Icon name={icon} size={10} />}
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Create `src/components/atoms/spark-bars.tsx`**

```typescript
interface SparkBarsProps {
  values: number[];
}

export function SparkBars({ values }: SparkBarsProps) {
  const max = Math.max(...values, 1);
  return (
    <div className="spark-mini">
      {values.map((v, i) => (
        <span
          key={i}
          className={i === values.length - 1 ? 'last' : ''}
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/atoms/
git commit -m "feat: add Icon, Tag, SparkBars atom components"
```

---

## Task 9: Settings context and shell

**Files:**
- Create: `src/lib/settings.tsx`
- Create: `src/components/shell/sidebar.tsx`
- Create: `src/components/shell/topbar.tsx`

- [ ] **Step 1: Create `src/lib/settings.tsx`**

```typescript
'use client';
import { createContext, useContext, useState, useEffect } from 'react';

interface Settings {
  accent: 'violet' | 'emerald' | 'amber' | 'sky';
  density: 'compact' | 'cozy' | 'comfortable';
  privacy: boolean;
}

interface SettingsCtx {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const ACCENTS: Record<string, string> = {
  violet:  '#a78bfa',
  emerald: '#5fd39a',
  amber:   '#f5b754',
  sky:     '#6ec1f0',
};

const defaults: Settings = { accent: 'violet', density: 'cozy', privacy: false };

const Ctx = createContext<SettingsCtx>({ settings: defaults, update: () => {} });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaults);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lifeos-settings');
      if (raw) setSettings(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    const hex = ACCENTS[settings.accent] ?? ACCENTS.violet;
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--accent-soft', hex + '1f');
    document.body.dataset.density = settings.density;
    document.body.dataset.privacy = settings.privacy ? 'on' : 'off';
  }, [settings]);

  const update: SettingsCtx['update'] = (key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('lifeos-settings', JSON.stringify(next));
      return next;
    });
  };

  return <Ctx.Provider value={{ settings, update }}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
```

- [ ] **Step 2: Create `src/components/shell/sidebar.tsx`**

```typescript
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/atoms/icon';

const NAV = [
  { href: '/',             label: 'Início',       icon: 'home',     badge: null },
  { href: '/financas',     label: 'Finanças',     icon: 'wallet',   badge: null },
  { href: '/contas',       label: 'Contas',       icon: 'calendar', badge: null },
  { href: '/assinaturas',  label: 'Assinaturas',  icon: 'repeat',   badge: null },
  { href: '/lista',        label: 'Lista',        icon: 'cart',     badge: null },
];

interface SidebarProps {
  lastSync?: string;
}

export function Sidebar({ lastSync = '—' }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="side">
      <div className="brand">
        <div className="brand-mark">L</div>
        <div>
          <div className="brand-name">Life OS</div>
          <div className="brand-sub">v0.1 · local</div>
        </div>
      </div>

      <div className="nav-label">Workspace</div>

      {NAV.map(item => {
        const active = item.href === '/'
          ? pathname === '/'
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${active ? ' active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <span className="ic"><Icon name={item.icon} size={17} /></span>
            <span>{item.label}</span>
            {item.badge && <span className="badge">{item.badge}</span>}
          </Link>
        );
      })}

      <div className="side-foot">
        <div className="row">
          <span className="dot" />
          SQLite ok
        </div>
        <div className="row" style={{ color: 'var(--text-2)' }}>
          Última sync: {lastSync}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            Pluggy conectado
          </span>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Create `src/components/shell/topbar.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/atoms/icon';
import { useSettings } from '@/lib/settings';

const TITLES: Record<string, [string, string]> = {
  '/':             ['Início',         'Visão geral'],
  '/financas':     ['Finanças',       'Contas e transações'],
  '/contas':       ['Contas a pagar', 'Próximos vencimentos'],
  '/assinaturas':  ['Assinaturas',    'Recorrentes ativas'],
  '/lista':        ['Lista',          'Itens da semana'],
};

interface TopbarProps {
  onSyncComplete?: () => void;
}

export function Topbar({ onSyncComplete }: TopbarProps) {
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('—');
  const { settings, update } = useSettings();

  const [title] = TITLES[pathname] ?? ['Life OS', ''];

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/sync', { method: 'POST' });
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setLastSync(`Hoje, ${now}`);
      onSyncComplete?.();
    } catch {
      // errors shown in console; sync_log captures details
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="top">
      <div className="crumbs">
        <span>Life OS</span>
        <span className="sep"><Icon name="chevron" size={12} /></span>
        <span className="here">{title}</span>
      </div>
      <div className="spacer" />

      <div className={`sync-strip${syncing ? ' syncing' : ''}`}>
        <span className="pulse" />
        {syncing
          ? 'Sincronizando…'
          : <span>sincronizado · <span style={{ color: 'var(--text-3)' }}>{lastSync}</span></span>
        }
      </div>

      <div className="search">
        <Icon name="search" size={14} color="var(--text-3)" />
        <input placeholder="Buscar transação, conta…" readOnly />
        <kbd>⌘K</kbd>
      </div>

      <button
        className="priv"
        onClick={() => update('privacy', !settings.privacy)}
        title="Modo privado"
      >
        <Icon name={settings.privacy ? 'eyeOff' : 'eye'} size={16} />
      </button>

      <button className="btn" title="Notificações">
        <Icon name="bell" size={15} />
      </button>

      <button className="btn primary" onClick={handleSync} disabled={syncing}>
        <Icon name="sync" size={14} color="#14112b" />
        {syncing ? 'Sincronizando' : 'Sincronizar'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/settings.tsx src/components/shell/
git commit -m "feat: add SettingsContext, Sidebar, and Topbar shell components"
```

---

## Task 10: Root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace `src/app/layout.tsx` with wired layout**

```typescript
import type { Metadata } from 'next';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { SettingsProvider } from '@/lib/settings';
import './globals.css';

export const metadata: Metadata = { title: 'Life OS' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body data-density="cozy" data-privacy="off">
        <SettingsProvider>
          <div className="app">
            <Sidebar />
            <div className="main">
              <Topbar />
              <div className="content">
                {children}
              </div>
            </div>
          </div>
        </SettingsProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify shell renders**

Open `http://localhost:3000`. Expected: sidebar with nav items on left, topbar at top, placeholder content in center.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wire SettingsProvider, Sidebar, and Topbar into root layout"
```

---

## Task 11: Home page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/pages/home/kpi-grid.tsx`
- Create: `src/components/pages/home/recent-activity.tsx`
- Create: `src/components/pages/home/calendar-strip.tsx`
- Create: `src/components/pages/home/category-allocation.tsx`

- [ ] **Step 1: Create `src/components/pages/home/kpi-grid.tsx`**

```typescript
'use client';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/atoms/icon';
import { SparkBars } from '@/components/atoms/spark-bars';
import { fmt } from '@/lib/fmt';
import { daysUntilDue } from '@/lib/dates';
import type { Account, Bill, Transaction } from '@/db/schema';

interface KpiGridProps {
  accounts: Account[];
  bills: Bill[];
  transactions: Transaction[];
}

export function KpiGrid({ accounts, bills, transactions }: KpiGridProps) {
  const router = useRouter();

  const totalBalance = accounts
    .filter(a => a.type === 'checking')
    .reduce((s, a) => s + a.balance, 0);

  const month = new Date().toISOString().slice(0, 7);
  const monthOut = transactions
    .filter(t => t.amount < 0 && t.date.startsWith(month))
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthIn = transactions
    .filter(t => t.amount > 0 && t.date.startsWith(month))
    .reduce((s, t) => s + t.amount, 0) || 1;

  const unpaid = bills.filter(b => !b.isPaid);
  const urgent = unpaid.filter(b => daysUntilDue(b.dueDay) <= 3).length;
  const next = [...unpaid].sort((a, b) => daysUntilDue(a.dueDay) - daysUntilDue(b.dueDay))[0];

  return (
    <div className="kpi-grid">
      <div className="kpi accent" onClick={() => router.push('/financas')}>
        <div className="label">
          Saldo total
          <span className="ic-wrap" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Icon name="wallet" size={14} />
          </span>
        </div>
        <div className="num mask">{fmt(totalBalance)}</div>
        <div className="delta" style={{ color: 'var(--text-2)', fontSize: 11.5 }}>
          {accounts.length} contas conectadas
        </div>
        <div className="footer">
          <span>{accounts.length} contas</span>
          <Icon name="chevron" size={12} color="var(--text-3)" />
        </div>
      </div>

      <div className="kpi danger" onClick={() => router.push('/contas')}>
        <div className="label">
          Alertas
          <span className="ic-wrap" style={{ background: 'color-mix(in oklch, var(--danger) 18%, transparent)', color: 'var(--danger)' }}>
            <Icon name="bell" size={14} />
          </span>
        </div>
        <div className="num">{urgent}</div>
        <div className="delta" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
          {next ? `${next.name} · dia ${next.dueDay}` : 'Nenhuma conta urgente'}
        </div>
        <div className="footer">
          <span>{unpaid.length} em aberto</span>
          <Icon name="chevron" size={12} color="var(--text-3)" />
        </div>
      </div>

      <div className="kpi good" onClick={() => router.push('/financas')}>
        <div className="label">
          Gastos · {new Date().toLocaleDateString('pt-BR', { month: 'short' })}
          <span className="ic-wrap" style={{ background: 'color-mix(in oklch, var(--good) 18%, transparent)', color: 'var(--good)' }}>
            <Icon name="arrowDown" size={14} />
          </span>
        </div>
        <div className="num mask">{fmt(monthOut)}</div>
        <div className="delta" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
          de {fmt(monthIn)} de entradas
        </div>
        <div className="footer">
          <div className="bar" style={{ flex: 1, marginRight: 8 }}>
            <span style={{ width: `${Math.min((monthOut / monthIn) * 100, 100)}%`, background: 'var(--good)' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {Math.round((monthOut / monthIn) * 100)}%
          </span>
        </div>
      </div>

      <div className="kpi warn" onClick={() => router.push('/contas')}>
        <div className="label">
          Próx. conta
          <span className="ic-wrap" style={{ background: 'color-mix(in oklch, var(--warn) 18%, transparent)', color: 'var(--warn)' }}>
            <Icon name="calendar" size={14} />
          </span>
        </div>
        <div className="num" style={{ fontSize: next ? 20 : 26 }}>
          {next ? next.name : '—'}
        </div>
        <div className="delta" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>
          {next ? `dia ${next.dueDay} · ${fmt(next.amount ?? 0)}` : 'Nenhuma conta pendente'}
        </div>
        <div className="footer">
          {next
            ? <><span>em {daysUntilDue(next.dueDay)} dia(s)</span><SparkBars values={[3,5,2,7,4,6,8]} /></>
            : <span>—</span>
          }
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/pages/home/recent-activity.tsx`**

```typescript
import { Icon } from '@/components/atoms/icon';
import { Tag } from '@/components/atoms/tag';
import { fmt } from '@/lib/fmt';
import { dayLabel } from '@/lib/dates';
import type { Account, Transaction } from '@/db/schema';

interface RecentActivityProps {
  transactions: Transaction[];
  accounts: Account[];
}

export function RecentActivity({ transactions, accounts }: RecentActivityProps) {
  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <div className="card card-no-pad">
      <div className="card-head">
        <h2>Atividade recente</h2>
        <span className="sub">últimas 6 transações</span>
      </div>
      <div className="list">
        {recent.length === 0 && (
          <div className="row" style={{ color: 'var(--text-3)', justifyContent: 'center' }}>
            Nenhuma transação — sincronize primeiro
          </div>
        )}
        {recent.map(t => {
          const acct = accounts.find(a => a.id === t.accountId);
          return (
            <div className="row" key={t.id}>
              <div className="lead">
                {t.amount > 0
                  ? <Icon name="arrowDown" size={14} color="var(--good)" />
                  : <Icon name="arrowUp" size={14} color="var(--text-2)" />}
              </div>
              <div className="body">
                <div className="title">{t.description}</div>
                <div className="sub">
                  <span style={{ color: acct?.color }}>● {acct?.bank ?? '—'}</span>
                  <span>·</span>
                  <span>{t.category || 'Sem categoria'}</span>
                  <span>·</span>
                  <span>{dayLabel(t.date)}</span>
                </div>
              </div>
              <div className={`amt ${t.amount > 0 ? 'in' : 'out'} mask`}>
                {fmt(t.amount, { signed: true })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/pages/home/calendar-strip.tsx`**

```typescript
import type { Bill } from '@/db/schema';

interface CalendarStripProps {
  bills: Bill[];
}

export function CalendarStrip({ bills }: CalendarStripProps) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const DOW = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

  return (
    <div className="calendar-strip">
      {days.map((d, i) => {
        const hasBill = bills.some(b => !b.isPaid && b.dueDay === d.getDate());
        return (
          <div key={i} className={`cell${i === 0 ? ' today' : ''}`}>
            <span className="dow">{DOW[d.getDay()]}</span>
            <span className="dn">{d.getDate()}</span>
            {hasBill && <span className="pip" />}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/pages/home/category-allocation.tsx`**

```typescript
import { fmt } from '@/lib/fmt';
import type { Transaction } from '@/db/schema';

interface CategoryAllocationProps {
  transactions: Transaction[];
}

export function CategoryAllocation({ transactions }: CategoryAllocationProps) {
  const month = new Date().toISOString().slice(0, 7);
  const debits = transactions.filter(t => t.amount < 0 && t.date.startsWith(month));

  const catMap = new Map<string, number>();
  for (const t of debits) {
    const cat = t.category || 'Outros';
    catMap.set(cat, (catMap.get(cat) ?? 0) + Math.abs(t.amount));
  }

  const cats = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const total = cats.reduce((s, [, v]) => s + v, 0) || 1;

  const COLORS = [
    'var(--accent)', 'var(--good)', 'var(--info)', 'var(--warn)', 'var(--danger)',
  ];

  if (cats.length === 0) {
    return (
      <div className="card card-no-pad">
        <div className="card-head"><h2>Onde foi o dinheiro</h2></div>
        <div className="card-pad" style={{ color: 'var(--text-3)', fontSize: 13 }}>
          Sem gastos este mês ainda
        </div>
      </div>
    );
  }

  return (
    <div className="card card-no-pad">
      <div className="card-head">
        <h2>Onde foi o dinheiro</h2>
        <span className="sub">{new Date().toLocaleDateString('pt-BR', { month: 'long' })}</span>
      </div>
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cats.map(([name, v], i) => (
          <div key={name} className="prog">
            <div className="label">
              <span className="name">
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: COLORS[i], marginRight: 8 }} />
                {name}
              </span>
              <span className="v mask">{fmt(v)}</span>
            </div>
            <div className="track">
              <div className="fill" style={{ width: `${(v / total) * 100}%`, background: COLORS[i] }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Replace `src/app/page.tsx` with full home page**

```typescript
import { db } from '@/db/client';
import { accounts, transactions, bills } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { KpiGrid } from '@/components/pages/home/kpi-grid';
import { RecentActivity } from '@/components/pages/home/recent-activity';
import { CalendarStrip } from '@/components/pages/home/calendar-strip';
import { CategoryAllocation } from '@/components/pages/home/category-allocation';

export default function HomePage() {
  const allAccounts = db.select().from(accounts).all();
  const allTransactions = db.select().from(transactions).orderBy(desc(transactions.date)).all();
  const allBills = db.select().from(bills).all();

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Bom dia' : today.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const dateStr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting} 👋</h1>
          <div className="sub">{dateStr}</div>
        </div>
      </div>

      <KpiGrid accounts={allAccounts} bills={allBills} transactions={allTransactions} />

      <div className="two-col">
        <RecentActivity transactions={allTransactions} accounts={allAccounts} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-no-pad">
            <div className="card-head">
              <h2>Próximos 7 dias</h2>
            </div>
            <div className="card-pad">
              <CalendarStrip bills={allBills} />
            </div>
          </div>
          <CategoryAllocation transactions={allTransactions} />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 6: Open `http://localhost:3000` and verify home page renders correctly**

Expected: KPI grid with 4 cards, empty activity list with "sincronize primeiro" message, 7-day calendar strip, empty category chart.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/components/pages/home/
git commit -m "feat: implement home page with KPI grid, recent activity, calendar, and category allocation"
```

---

## Task 12: Finanças page

**Files:**
- Create: `src/app/financas/page.tsx`
- Create: `src/components/pages/financas/account-chips.tsx`
- Create: `src/components/pages/financas/transactions-table.tsx`

- [ ] **Step 1: Create `src/components/pages/financas/account-chips.tsx`**

```typescript
import { fmt } from '@/lib/fmt';
import type { Account } from '@/db/schema';

interface AccountChipsProps {
  accounts: Account[];
}

export function AccountChips({ accounts }: AccountChipsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
      {accounts.map(a => (
        <div key={a.id} className="acct-chip">
          <div className="dot" style={{ background: a.color }}>{a.bank[0]}</div>
          <div className="meta">
            <div className="name">{a.bank} · {a.name}</div>
            <div className="info">
              {a.last4 ? `•••• ${a.last4}` : '—'} · {a.type === 'credit' ? 'crédito' : 'corrente'}
            </div>
          </div>
          <div
            className="balance mask"
            style={{ color: a.balance < 0 ? 'var(--danger)' : 'var(--text-0)' }}
          >
            {fmt(a.balance)}
          </div>
        </div>
      ))}
      {accounts.length === 0 && (
        <div style={{ gridColumn: '1/-1', color: 'var(--text-3)', padding: 12, fontSize: 13 }}>
          Nenhuma conta conectada — clique em Sincronizar para importar.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/pages/financas/transactions-table.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { Icon } from '@/components/atoms/icon';
import { Tag } from '@/components/atoms/tag';
import { fmt } from '@/lib/fmt';
import { dayLabel } from '@/lib/dates';
import type { Account, Transaction } from '@/db/schema';

interface TransactionsTableProps {
  transactions: Transaction[];
  accounts: Account[];
}

export function TransactionsTable({ transactions, accounts }: TransactionsTableProps) {
  const [catFilter, setCatFilter] = useState('all');
  const [acctFilter, setAcctFilter] = useState('all');

  const categories = ['all', ...new Set(transactions.map(t => t.category).filter(Boolean))];

  const filtered = transactions.filter(t =>
    (catFilter === 'all' || t.category === catFilter) &&
    (acctFilter === 'all' || t.accountId === acctFilter)
  );

  return (
    <div className="card card-no-pad">
      <div className="card-head">
        <h2>Transações</h2>
        <span className="sub">{filtered.length} resultados</span>
        <div className="right">
          <select
            value={acctFilter}
            onChange={e => setAcctFilter(e.target.value)}
            className="btn"
            style={{ paddingRight: 28 }}
          >
            <option value="all">Todas as contas</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.bank} · {a.name}</option>
            ))}
          </select>
          <button className="btn ghost"><Icon name="filter" size={14} /></button>
        </div>
      </div>

      <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="chips">
          {categories.map(c => (
            <span
              key={c}
              className={`chip${catFilter === c ? ' on' : ''}`}
              onClick={() => setCatFilter(c)}
            >
              {c === 'all' ? 'Todas categorias' : c}
            </span>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card-pad" style={{ color: 'var(--text-3)', fontSize: 13 }}>
          Nenhuma transação encontrada.
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Conta</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const acct = accounts.find(a => a.id === t.accountId);
              return (
                <tr key={t.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                    {dayLabel(t.date)}
                  </td>
                  <td style={{ color: 'var(--text-0)' }}>{t.description}</td>
                  <td><Tag>{t.category || '—'}</Tag></td>
                  <td>
                    <span style={{ color: acct?.color }}>●</span>{' '}
                    <span style={{ color: 'var(--text-2)' }}>{acct?.bank ?? '—'}</span>
                  </td>
                  <td
                    className="num-cell mask"
                    style={{ color: t.amount > 0 ? 'var(--good)' : 'var(--text-0)' }}
                  >
                    {fmt(t.amount, { signed: true })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/financas/page.tsx`**

```typescript
import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { AccountChips } from '@/components/pages/financas/account-chips';
import { TransactionsTable } from '@/components/pages/financas/transactions-table';
import { fmt } from '@/lib/fmt';

export default function FinancasPage() {
  const allAccounts = db.select().from(accounts).all();
  const allTransactions = db.select().from(transactions).orderBy(desc(transactions.date)).all();
  const totalBalance = allAccounts
    .filter(a => a.type === 'checking')
    .reduce((s, a) => s + a.balance, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Finanças</h1>
          <div className="sub">
            Saldo total{' '}
            <span className="mask" style={{ color: 'var(--text-0)', fontFamily: 'var(--font-mono)' }}>
              {fmt(totalBalance)}
            </span>{' '}
            · {allAccounts.length} conta(s)
          </div>
        </div>
        <div className="right">
          <button className="btn ghost">
            <span style={{ fontSize: 13 }}>Exportar CSV</span>
          </button>
        </div>
      </div>

      <AccountChips accounts={allAccounts} />
      <TransactionsTable transactions={allTransactions} accounts={allAccounts} />
    </>
  );
}
```

- [ ] **Step 4: Verify page at `http://localhost:3000/financas`**

Expected: account chips section (empty message if no sync yet), transaction table with filter chips.

- [ ] **Step 5: Commit**

```bash
git add src/app/financas/ src/components/pages/financas/
git commit -m "feat: implement finanças page with account chips and transaction table"
```

---

## Task 13: Contas page

**Files:**
- Create: `src/app/contas/page.tsx`
- Create: `src/components/pages/contas/bills-list.tsx`

- [ ] **Step 1: Create `src/components/pages/contas/bills-list.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { Icon } from '@/components/atoms/icon';
import { Tag } from '@/components/atoms/tag';
import { fmt } from '@/lib/fmt';
import { daysUntilDue, billTone } from '@/lib/dates';
import type { Bill } from '@/db/schema';

interface BillsListProps {
  initialBills: Bill[];
}

type Tab = 'open' | 'paid' | 'review' | 'all';

export function BillsList({ initialBills }: BillsListProps) {
  const [bills, setBills] = useState(initialBills);
  const [tab, setTab] = useState<Tab>('open');

  const open   = bills.filter(b => !b.isPaid);
  const paid   = bills.filter(b => b.isPaid);
  const review = bills.filter(b => b.needsReview && !b.isPaid);

  const tabBills = tab === 'open' ? open : tab === 'paid' ? paid : tab === 'review' ? review : bills;
  const sorted = [...tabBills].sort((a, b) => daysUntilDue(a.dueDay) - daysUntilDue(b.dueDay));
  const totalOpen = open.reduce((s, b) => s + (b.amount ?? 0), 0);

  const togglePaid = async (bill: Bill) => {
    const next = !bill.isPaid;
    await fetch(`/api/bills/${bill.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPaid: next }),
    });
    setBills(bs => bs.map(b => b.id === bill.id ? { ...b, isPaid: next ? 1 : 0 } : b));
  };

  const addBill = async () => {
    const name = prompt('Nome da conta:');
    if (!name) return;
    const amountStr = prompt('Valor (deixe vazio se desconhecido):');
    const dayStr = prompt('Dia do vencimento (1-31):');
    if (!dayStr) return;

    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        amount: amountStr ? parseFloat(amountStr) : null,
        dueDay: parseInt(dayStr),
        category: 'Outros',
      }),
    });
    const { id } = await res.json();
    setBills(bs => [...bs, {
      id, name, amount: amountStr ? parseFloat(amountStr) : null,
      dueDay: parseInt(dayStr), category: 'Outros', source: 'manual',
      isPaid: 0, paidAt: null, needsReview: 0,
      createdAt: Math.floor(Date.now() / 1000),
    }]);
  };

  return (
    <>
      {review.length > 0 && (
        <div className="hint">
          <span className="ic"><Icon name="bot" size={16} color="var(--accent)" /></span>
          <span>
            <b style={{ color: 'var(--text-0)' }}>{review.length} conta(s) auto-detectada(s)</b>{' '}
            aguardando revisão.
          </span>
          <div className="actions">
            <button className="btn ghost" onClick={() => setTab('review')}>Revisar</button>
          </div>
        </div>
      )}

      <div className="tabs">
        {([['open', 'Em aberto', open.length], ['paid', 'Pagas', paid.length], ['review', 'Auto-detectadas', review.length], ['all', 'Todas', bills.length]] as const).map(
          ([id, label, count]) => (
            <div
              key={id}
              className={`tab${tab === id ? ' active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}<span className="count">{count}</span>
            </div>
          )
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.length === 0 && (
          <div style={{ color: 'var(--text-3)', padding: 12, fontSize: 13 }}>
            Nenhuma conta nesta aba.
          </div>
        )}
        {sorted.map(b => {
          const tone = billTone(b.dueDay, !!b.isPaid);
          const days = daysUntilDue(b.dueDay);
          return (
            <div key={b.id} className={`bill ${tone}`}>
              <div className="due">
                <span className="day">{String(b.dueDay).padStart(2, '0')}</span>
                <span className="mo">{new Date().toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
              </div>
              <div className="body">
                <div className="name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {b.name}
                  {b.source === 'auto' && !b.needsReview && <Tag tone="info" icon="bot">auto</Tag>}
                  {!!b.needsReview && <Tag tone="warn">revisar</Tag>}
                  {!!b.isPaid && <Tag tone="good" icon="check">pago</Tag>}
                </div>
                <div className="meta">
                  <span>{b.category}</span>
                  <span>·</span>
                  <span>
                    {b.isPaid ? 'pago'
                      : days === 0 ? 'vence hoje'
                      : days === 1 ? 'vence amanhã'
                      : `vence em ${days} dias`}
                  </span>
                </div>
              </div>
              <div className="amt mask">{fmt(b.amount ?? 0)}</div>
              <button className="pay-btn" onClick={() => togglePaid(b)}>
                {b.isPaid
                  ? <><Icon name="check" size={12} color="var(--good)" /> pago</>
                  : 'marcar pago'}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create `src/app/contas/page.tsx`**

```typescript
import { db } from '@/db/client';
import { bills } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { BillsList } from '@/components/pages/contas/bills-list';
import { fmt } from '@/lib/fmt';

export default function ContasPage() {
  const allBills = db.select().from(bills).orderBy(asc(bills.dueDay)).all();
  const totalOpen = allBills.filter(b => !b.isPaid).reduce((s, b) => s + (b.amount ?? 0), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Contas a pagar</h1>
          <div className="sub">
            {allBills.filter(b => !b.isPaid).length} em aberto · total{' '}
            <span className="mask" style={{ color: 'var(--text-0)', fontFamily: 'var(--font-mono)' }}>
              {fmt(totalOpen)}
            </span>
          </div>
        </div>
        <div className="right">
          <button className="btn">
            <span style={{ fontSize: 13 }}>+ Adicionar conta</span>
          </button>
        </div>
      </div>

      <BillsList initialBills={allBills} />
    </>
  );
}
```

- [ ] **Step 3: Verify at `http://localhost:3000/contas`**

Expected: empty state with "Nenhuma conta nesta aba." Add a test bill via the API and verify it appears with correct urgency color.

- [ ] **Step 4: Commit**

```bash
git add src/app/contas/ src/components/pages/contas/
git commit -m "feat: implement contas page with tabs, urgency colors, and mark-paid toggle"
```

---

## Task 14: Assinaturas page

**Files:**
- Create: `src/app/assinaturas/page.tsx`
- Create: `src/components/pages/assinaturas/subs-page.tsx`

- [ ] **Step 1: Create `src/components/pages/assinaturas/subs-page.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { Icon } from '@/components/atoms/icon';
import { Tag } from '@/components/atoms/tag';
import { fmt } from '@/lib/fmt';
import type { Subscription } from '@/db/schema';

const LOGOS: Record<string, { bg: string; glyph: string }> = {
  'Netflix':         { bg: '#E50914', glyph: 'N' },
  'Spotify':         { bg: '#1ED760', glyph: '♪' },
  'Disney+':         { bg: '#1B3D6B', glyph: 'D+' },
  'ChatGPT Plus':    { bg: '#10A37F', glyph: 'GPT' },
  'Cursor Pro':      { bg: '#222',    glyph: '⌘' },
  'iCloud':          { bg: '#3FA5F5', glyph: '☁' },
  'Notion':          { bg: '#fff',    glyph: 'N' },
  'Amazon Prime':    { bg: '#00A8E1', glyph: 'a' },
  'YouTube Premium': { bg: '#FF0000', glyph: '▶' },
  'GitHub':          { bg: '#24292f', glyph: '⊙' },
  'Claude':          { bg: '#D97757', glyph: 'C' },
};

interface SubsPageProps {
  initialSubs: Subscription[];
}

export function SubsPage({ initialSubs }: SubsPageProps) {
  const [subs, setSubs] = useState(initialSubs);
  const [catFilter, setCatFilter] = useState('all');

  const cats = ['all', ...new Set(subs.map(s => s.category))];
  const filtered = catFilter === 'all' ? subs : subs.filter(s => s.category === catFilter);
  const active = subs.filter(s => s.isActive);
  const totalMonth = active.reduce((s, x) => s + x.amount, 0);

  const streamingTotal = active.filter(s => s.category === 'Streaming').reduce((s, x) => s + x.amount, 0);
  const aiTotal = active.filter(s => s.category === 'IA').reduce((s, x) => s + x.amount, 0);

  const nextSub = [...active].sort((a, b) => {
    const today = new Date().getDate();
    const da = a.billingDay >= today ? a.billingDay - today : 31 - today + a.billingDay;
    const db = b.billingDay >= today ? b.billingDay - today : 31 - today + b.billingDay;
    return da - db;
  })[0];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <div className="card">
          <h3>Total mensal</h3>
          <div className="num accent mask">{fmt(totalMonth)}</div>
          <div className="meta">{active.length} serviços ativos</div>
        </div>
        <div className="card">
          <h3>Streaming</h3>
          <div className="num mask">{fmt(streamingTotal)}</div>
          <div className="meta">{active.filter(s => s.category === 'Streaming').length} assinaturas</div>
        </div>
        <div className="card">
          <h3>IA & Dev</h3>
          <div className="num mask">{fmt(aiTotal)}</div>
          <div className="meta">{active.filter(s => s.category === 'IA').length} assinaturas</div>
        </div>
        <div className="card">
          <h3>Próxima cobrança</h3>
          {nextSub
            ? <><div className="num warn">dia {nextSub.billingDay}</div><div className="meta">{nextSub.name} · {fmt(nextSub.amount)}</div></>
            : <div className="num" style={{ color: 'var(--text-3)' }}>—</div>
          }
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 12 }}>
        {cats.map(c => (
          <span key={c} className={`chip${catFilter === c ? ' on' : ''}`} onClick={() => setCatFilter(c)}>
            {c === 'all' ? 'Todas' : c}
          </span>
        ))}
      </div>

      <div className="subs-grid">
        {filtered.length === 0 && (
          <div style={{ color: 'var(--text-3)', fontSize: 13, gridColumn: '1/-1' }}>
            Nenhuma assinatura encontrada.
          </div>
        )}
        {filtered.map(s => {
          const logo = LOGOS[s.name] ?? { bg: 'var(--accent)', glyph: s.name[0] };
          return (
            <div key={s.id} className={`sub-card${!s.isActive ? ' inactive' : ''}`}>
              <div className="head">
                <div
                  className="logo"
                  style={{ background: logo.bg, color: logo.bg === '#fff' ? '#000' : '#fff' }}
                >
                  {logo.glyph}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="name">{s.name}</div>
                  <div className="cat">{s.category}{s.source === 'auto' ? ' · auto' : ''}</div>
                </div>
                <button className="btn ghost icon"><Icon name="edit" size={14} /></button>
              </div>
              <div className="price-row">
                <span className="price mask">{fmt(s.amount)}</span>
                <span className="per">/mês</span>
              </div>
              <div className="next">
                <Icon name="calendar" size={12} color="var(--text-3)" />
                Próx. cobrança dia <b style={{ color: 'var(--text-1)' }}>{s.billingDay}</b>
                {s.alertDays > 0 && <Tag>alerta {s.alertDays}d antes</Tag>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create `src/app/assinaturas/page.tsx`**

```typescript
import { db } from '@/db/client';
import { subscriptions } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { SubsPage } from '@/components/pages/assinaturas/subs-page';

export default function AssinaturasPage() {
  const allSubs = db.select().from(subscriptions).orderBy(asc(subscriptions.billingDay)).all();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assinaturas</h1>
          <div className="sub">
            {allSubs.filter(s => s.isActive).length} ativas
          </div>
        </div>
        <div className="right">
          <button className="btn">+ Nova assinatura</button>
        </div>
      </div>

      <SubsPage initialSubs={allSubs} />
    </>
  );
}
```

- [ ] **Step 3: Verify at `http://localhost:3000/assinaturas`**

Expected: 4 KPI cards, category filter chips, empty subscription grid with empty state message.

- [ ] **Step 4: Commit**

```bash
git add src/app/assinaturas/ src/components/pages/assinaturas/
git commit -m "feat: implement assinaturas page with KPI cards, filters, and subscription grid"
```

---

## Task 15: Lista page

**Files:**
- Create: `src/app/lista/page.tsx`
- Create: `src/components/pages/lista/shopping-list.tsx`

- [ ] **Step 1: Create `src/components/pages/lista/shopping-list.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { Icon } from '@/components/atoms/icon';
import type { ShoppingItem } from '@/db/schema';

interface ShoppingListProps {
  initialItems: ShoppingItem[];
}

const CATEGORIES = ['Hortifruti', 'Mercado', 'Limpeza', 'Outros'];

export function ShoppingList({ initialItems }: ShoppingListProps) {
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState('');
  const [draftCat, setDraftCat] = useState('Mercado');

  const total = items.length;
  const done = items.filter(i => i.isChecked).length;
  const cats = [...new Set(items.map(i => i.category))];

  const toggle = async (item: ShoppingItem) => {
    const next = !item.isChecked;
    await fetch(`/api/shopping/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isChecked: next }),
    });
    setItems(xs => xs.map(x => x.id === item.id ? { ...x, isChecked: next ? 1 : 0 } : x));
  };

  const addItem = async () => {
    const name = draft.trim();
    if (!name) return;
    const res = await fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category: draftCat, isRecurring: false }),
    });
    const { id } = await res.json();
    setItems(xs => [...xs, {
      id, name, category: draftCat, isRecurring: 0, isChecked: 0,
      createdAt: Math.floor(Date.now() / 1000),
    }]);
    setDraft('');
  };

  const clearChecked = async () => {
    const checked = items.filter(i => i.isChecked);
    await Promise.all(checked.map(i =>
      fetch(`/api/shopping/${i.id}`, { method: 'DELETE' })
    ));
    setItems(xs => xs.filter(x => !x.isChecked));
  };

  const allCats = [...new Set([...cats, ...CATEGORIES])];

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
                  onClick={() => toggle(item)}
                >
                  <span className="check">
                    {item.isChecked && <Icon name="check" size={12} color="#14112b" />}
                  </span>
                  <span className="label">{item.name}</span>
                  {!!item.isRecurring && <span className="recur">↻ recorrente</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {items.length === 0 && (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>
          Lista vazia — adicione itens acima.
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create `src/app/lista/page.tsx`**

```typescript
import { db } from '@/db/client';
import { shoppingItems } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { ShoppingList } from '@/components/pages/lista/shopping-list';
import { Icon } from '@/components/atoms/icon';

export default function ListaPage() {
  const allItems = db.select().from(shoppingItems).orderBy(asc(shoppingItems.category)).all();
  const done = allItems.filter(i => i.isChecked).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lista de compras</h1>
          <div className="sub">
            {done}/{allItems.length} concluídos ·{' '}
            {allItems.filter(i => i.isRecurring).length} recorrentes
          </div>
        </div>
        <div className="right">
          <button className="btn ghost">
            <Icon name="trash" size={14} /> Limpar marcados
          </button>
        </div>
      </div>

      <ShoppingList initialItems={allItems} />
    </>
  );
}
```

- [ ] **Step 3: Verify at `http://localhost:3000/lista`**

Expected: input box with category selector and Adicionar button, empty list state. Add a test item and verify it appears, then click to check it off.

- [ ] **Step 4: Commit**

```bash
git add src/app/lista/ src/components/pages/lista/
git commit -m "feat: implement lista de compras with add, check off, clear, and categories"
```

---

## Task 16: Final verification

- [ ] **Step 1: Run all tests**

```powershell
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 2: Check TypeScript**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Add sample data and do a full walkthrough**

Add test data via curl to verify all pages:

```powershell
# Add a bill
curl -X POST http://localhost:3000/api/bills -H "Content-Type: application/json" -d '{\"name\":\"Luz\",\"amount\":120.40,\"dueDay\":5,\"category\":\"Moradia\"}'

# Add a subscription
curl -X POST http://localhost:3000/api/subscriptions -H "Content-Type: application/json" -d '{\"name\":\"Netflix\",\"amount\":55.90,\"billingDay\":12,\"category\":\"Streaming\"}'

# Add shopping items
curl -X POST http://localhost:3000/api/shopping -H "Content-Type: application/json" -d '{\"name\":\"Banana\",\"category\":\"Hortifruti\",\"isRecurring\":true}'
curl -X POST http://localhost:3000/api/shopping -H "Content-Type: application/json" -d '{\"name\":\"Leite\",\"category\":\"Mercado\",\"isRecurring\":true}'
```

- [ ] **Step 4: Verify each page**

1. `/` — KPI card "Próx. conta" shows Luz / dia 5
2. `/contas` — bill appears with urgency color
3. `/assinaturas` — Netflix card appears in grid, total mensal = R$ 55,90
4. `/lista` — Banana and Leite in their categories, click to toggle check

- [ ] **Step 5: Test privacy toggle**

Click the eye icon in topbar. All `.mask` and `.num` elements should blur. Hover over a KPI card to reveal its value.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Life OS financial core — all 5 pages functional"
```

---

## Post-implementation notes

**Pluggy first sync:**
1. Add real `PLUGGY_ITEM_IDS` to `.env.local` (get item IDs from Pluggy dashboard after connecting your banks)
2. Click "Sincronizar" in the topbar
3. Check `/api/accounts` and `/api/transactions` for imported data

**If `pluggy-sdk` API differs from plan:**
- Check `node_modules/pluggy-sdk/dist/index.d.ts` for actual type definitions
- Key fields to verify: `Account.type`, `Account.balance`, `Transaction.amount` sign convention, `Transaction.date` format
- Adjust `src/lib/pluggy.ts` field mappings accordingly

**Rotate Pluggy credentials:**
Credentials were shared in conversation — rotate them at https://dashboard.pluggy.ai before use.
