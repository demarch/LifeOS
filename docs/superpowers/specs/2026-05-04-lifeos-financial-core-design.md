# Life OS — Financial Core Design

**Date:** 2026-05-04
**Sub-project:** 1 of 4 (Financial Core)
**Status:** Approved

---

## Overview

Personal life management OS running locally on desktop. Browser-based UI served from `localhost:3000`. No cloud hosting, no auth. Data lives entirely in a local SQLite file.

This spec covers sub-project 1: Financial Core. Subsequent sub-projects (Subscriptions, Shopping List, Integrations) will each get their own spec.

---

## Architecture

- **Framework:** Next.js 14 App Router
- **Language:** TypeScript
- **Database:** SQLite via Drizzle ORM + better-sqlite3
- **Pluggy:** Official JS SDK, called server-side only (API routes)
- **UI:** React Server Components + shadcn/ui, design system from mockup
- **Fonts:** Inter (UI) + JetBrains Mono (numbers/dates)
- **Run:** `npm run dev` — single process, single terminal

No authentication. No external deployment. Credentials in `.env.local` (gitignored).

---

## Data Model

### `accounts`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | local UUID |
| pluggy_id | TEXT UNIQUE | Pluggy account ID |
| name | TEXT | e.g. "Conta corrente" |
| bank | TEXT | e.g. "Nubank" |
| type | TEXT | "checking" or "credit" |
| balance | REAL | current balance |
| color | TEXT | hex assigned by app from `BANK_COLORS` map (bank name → hex); Pluggy does not provide colors |
| last4 | TEXT | last 4 digits |
| limit | REAL | nullable, credit only |
| updated_at | INTEGER | unix timestamp |

### `transactions`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | local UUID |
| pluggy_id | TEXT UNIQUE | Pluggy transaction ID |
| account_id | TEXT FK | → accounts |
| description | TEXT | |
| amount | REAL | negative = debit |
| type | TEXT | "debit" or "credit" |
| category | TEXT | from Pluggy |
| date | TEXT | ISO date YYYY-MM-DD |
| created_at | INTEGER | unix timestamp |

### `bills`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | local UUID |
| name | TEXT | |
| amount | REAL | nullable if unknown |
| due_day | INTEGER | 1–31 |
| category | TEXT | |
| source | TEXT | "manual" or "auto" |
| is_paid | INTEGER | boolean 0/1 |
| paid_at | INTEGER | nullable unix timestamp |
| needs_review | INTEGER | boolean — auto-detected, unconfirmed |
| created_at | INTEGER | unix timestamp |

### `subscriptions`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | local UUID |
| name | TEXT | |
| amount | REAL | |
| billing_day | INTEGER | 1–31 |
| category | TEXT | "Streaming", "IA", "Outros" |
| source | TEXT | "manual" or "auto" |
| alert_days | INTEGER | default 3 |
| is_active | INTEGER | boolean |
| created_at | INTEGER | unix timestamp |

### `shopping_items`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | local UUID |
| name | TEXT | |
| category | TEXT | "Hortifruti", "Mercado", "Limpeza", etc. |
| is_recurring | INTEGER | boolean |
| is_checked | INTEGER | boolean |
| created_at | INTEGER | unix timestamp |

### `sync_log`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | local UUID |
| status | TEXT | "ok" or "error" |
| accounts_synced | INTEGER | |
| transactions_synced | INTEGER | |
| error_msg | TEXT | nullable |
| synced_at | INTEGER | unix timestamp |

---

## Pluggy Sync Flow

Manual trigger only — no background daemon.

1. User clicks "Sincronizar" in topbar
2. `POST /api/sync` called from client
3. Server-side: Pluggy SDK authenticates with `PLUGGY_CLIENT_ID` + `PLUGGY_CLIENT_SECRET`
4. Fetch all items from `PLUGGY_ITEM_IDS` (comma-separated in `.env.local`)
5. For each item: fetch accounts + transactions (last 90 days from current date at sync time)
6. Upsert accounts and transactions in SQLite (pluggy_id as dedup key)
7. Auto-detection pass on new transactions:
   - Recurring debits ±5 days/month, same merchant → bill candidate (`source="auto"`, `needs_review=1`)
   - Known keywords (Netflix, Spotify, ChatGPT, Cursor, iCloud, Disney) → subscription candidate (`source="auto"`)
8. Write `sync_log` entry (ok or error)
9. Return summary to client; client refreshes page data

**Error handling:**
- Auth failure → log error, return 500, toast shown client-side
- Partial item failure → continue other items, log individual errors
- Network timeout → retry once, then fail gracefully

**First run:** User must create Pluggy items via Pluggy Connect widget. Item IDs stored in `.env.local` as `PLUGGY_ITEM_IDS=id1,id2`.

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/sync | Trigger Pluggy sync |
| GET | /api/accounts | List accounts |
| GET | /api/transactions | List transactions (with filters) |
| GET/POST | /api/bills | List / create bills |
| PATCH | /api/bills/[id] | Update bill (mark paid, edit) |
| DELETE | /api/bills/[id] | Delete bill |
| GET/POST | /api/subscriptions | List / create subscriptions |
| PATCH | /api/subscriptions/[id] | Update subscription |
| DELETE | /api/subscriptions/[id] | Delete subscription |
| GET/POST | /api/shopping | List / add shopping items |
| PATCH | /api/shopping/[id] | Toggle checked, update |
| DELETE | /api/shopping/[id] | Delete item |

---

## Visual Design

From approved mockup (`design-bundle/lifeos/project/`). Implement pixel-perfectly.

### Design Tokens
```css
--bg-0: #0b0b14       /* page background */
--bg-1: #11111d       /* sidebar, cards */
--bg-2: #161624       /* inputs, chips */
--bg-3: #1c1c2e       /* badges */
--line: #232339       /* borders */
--line-2: #2d2d4a     /* hover borders */
--text-0: #f1f1f7     /* primary text */
--text-1: #c4c4d6     /* secondary text */
--text-2: #8a8aa0     /* muted */
--text-3: #5b5b75     /* very muted */
--accent: #a78bfa     /* violet, user-configurable */
--good: #5fd39a       /* green */
--warn: #f5b754       /* amber */
--danger: #f47272     /* red */
--info: #6ec1f0       /* blue */
```

### Layout
- Sidebar (232px fixed) + main content area
- Sticky topbar with breadcrumb, search, sync status, privacy toggle, sync button
- Content padding: 22px 28px

### Pages

**Home (`/`):**
- Greeting + date + last sync count
- 4 KPI cards (Saldo Total, Alertas, Gastos Maio, Próxima Conta)
- Two-column: Recent transactions list (left) + 7-day calendar + category allocation (right)

**Finanças (`/financas`):**
- Account chips (3-column grid) with bank color, balance
- Transaction table: date, description, category tag, account, amount
- Filters: category chips + account select dropdown

**Contas (`/contas`):**
- Auto-detected hint banner when unreviewed bills exist
- Tabs: Em aberto / Pagas / Auto-detectadas / Todas
- Bill rows with: due date badge, name + tags (auto/revisar/pago), amount, "marcar pago" button
- Color-coded urgency: red (≤3d), amber (≤7d), green (paid), blue (future)

**Assinaturas (`/assinaturas`):**
- 4 KPI cards: Total mensal, Streaming, IA & Dev, Próxima cobrança
- Category filter chips
- 3-column subscription card grid: logo, name, price, next billing day, alert badge

**Lista (`/lista`):**
- Add item input with category selector
- Progress bar (checked/total)
- Items grouped by category, recurring marked with ↻

### Interactions
- Sync button: loading state 1.9s, updates "última sync" timestamp
- Privacy toggle: blurs all `.num` and `.mask` elements; hover on KPI reveals
- Mark bill as paid: toggles `is_paid`, updates tab counts
- Shopping check: toggles `is_checked`, strikethrough label
- Category filter chips: filter transaction/subscription list
- Tweaks panel: accent color (violet/emerald/amber/sky/rose), density (compact/cozy/comfortable), privacy toggle

---

## Environment Variables

```env
PLUGGY_CLIENT_ID=<your-client-id>
PLUGGY_CLIENT_SECRET=<your-client-secret>
PLUGGY_ITEM_IDS=        # comma-separated item IDs, added after first Pluggy Connect run
```

> **Note:** Rotate credentials if they were shared in any chat or document. Store only in `.env.local`.

---

## Project Structure

```
lifeos/
├── .env.local              # credentials (gitignored)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx         # home
│   │   ├── financas/page.tsx
│   │   ├── contas/page.tsx
│   │   ├── assinaturas/page.tsx
│   │   ├── lista/page.tsx
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
│   │   ├── shell/           # Sidebar, Topbar
│   │   ├── atoms/           # Icon, Tag, SparkBars, fmt
│   │   └── pages/           # one component per page
│   ├── db/
│   │   ├── schema.ts        # Drizzle schema
│   │   ├── client.ts        # better-sqlite3 singleton
│   │   └── migrations/
│   └── lib/
│       └── pluggy.ts        # Pluggy SDK wrapper
├── design-bundle/           # reference mockup (read-only)
└── docs/
```

---

## Out of Scope (this sub-project)

- Obsidian integration
- Google Calendar integration
- Pluggy Connect widget (user sets up items manually via Pluggy dashboard)
- Mobile/PWA
- Export to CSV (button in mockup is present but non-functional)
- Push notifications / system alerts for bill due dates
