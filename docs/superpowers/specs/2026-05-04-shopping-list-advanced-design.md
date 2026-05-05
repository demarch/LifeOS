# Shopping List Advanced — Design Spec

**Date:** 2026-05-04
**Sub-projeto:** 3 of 4 — Lista de Compras

---

## Goal

Evolve the shopping list from a simple checkbox list into a session-aware list with a reusable base list, item quantities, and full purchase history with item frequency tracking.

## Architecture

### Database Schema

Four tables:

**`baseListItems`** — template of recurring items (the "lista base")
```
id          TEXT PRIMARY KEY
name        TEXT NOT NULL
category    TEXT NOT NULL
defaultQty  INTEGER NOT NULL DEFAULT 1
createdAt   INTEGER NOT NULL  -- unix timestamp
```

**`shoppingItems`** (existing — add `qty`, `baseListItemId`)
```
id              TEXT PRIMARY KEY
name            TEXT NOT NULL
category        TEXT NOT NULL
qty             INTEGER NOT NULL DEFAULT 1  ← new column
isChecked       INTEGER NOT NULL DEFAULT 0
isRecurring     INTEGER NOT NULL DEFAULT 0  (kept for badge, deprecated by baseListItems)
baseListItemId  TEXT REFERENCES baseListItems(id)  ← new column, nullable
createdAt       INTEGER NOT NULL
```

**`shoppingSessions`** — completed shopping trips
```
id           TEXT PRIMARY KEY
completedAt  INTEGER NOT NULL  -- unix timestamp
totalItems   INTEGER NOT NULL
totalChecked INTEGER NOT NULL
```

**`shoppingSessionItems`** — immutable record of what was bought
```
id              TEXT PRIMARY KEY
sessionId       TEXT NOT NULL REFERENCES shoppingSessions(id)
name            TEXT NOT NULL
category        TEXT NOT NULL
qty             INTEGER NOT NULL DEFAULT 1
baseListItemId  TEXT REFERENCES baseListItems(id)  -- nullable, for frequency queries
```

### Routes

- `/lista` — active shopping session
- `/lista/base` — manage base list (CRUD)
- `/lista/historico` — past sessions + item frequency

---

## Features

### 1. Item Quantities

`shoppingItems.qty` defaults to 1. Editable inline in the list (tap +/- or input). Saved on change via PATCH. Carried over to session history on checkout.

### 2. Base List (`/lista/base`)

CRUD UI for `baseListItems`. Fields: name, category, defaultQty. No checkbox — these are templates, not active items.

### 3. Session Close Flow ("Limpar marcados")

1. User clicks "Limpar marcados"
2. Client POSTs `/api/shopping/sessions` → server writes `shoppingSessions` + `shoppingSessionItems` from currently checked items, then deletes checked items from `shoppingItems`
3. Client shows modal: **"Iniciar nova compra?"**
   - **Sim** → POST `/api/shopping/from-base` → server copies `baseListItems` into `shoppingItems` (skipping duplicates by name+category), returns new items
   - **Não** → modal closes, list shows remaining unchecked items

### 4. Purchase History (`/lista/historico`)

Two views:

**Sessões** — chronological list of completed sessions
- Date, "X de Y itens comprados"
- Expandable: shows `shoppingSessionItems` with qty

**Por item** — frequency ranking
- Aggregates `shoppingSessionItems` grouped by `name` (case-insensitive)
- Shows: item name, category, total times bought, last purchase date
- Sorted by frequency descending

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/shopping/sessions` | Close active session (save history + delete checked) |
| POST | `/api/shopping/from-base` | Populate active list from base list |
| GET | `/api/shopping/sessions` | List past sessions |
| GET | `/api/shopping/sessions/[id]` | Items for one session |
| GET | `/api/shopping/frequency` | Item frequency ranking |
| GET | `/api/shopping/base` | List base items |
| POST | `/api/shopping/base` | Add base item |
| PATCH | `/api/shopping/base/[id]` | Edit base item |
| DELETE | `/api/shopping/base/[id]` | Remove base item |
| PATCH | `/api/shopping/[id]` | Update qty or isChecked on active item |

---

## UI Components

### `/lista` changes
- `ShoppingList` — add qty control per item (inline +/- buttons)
- Header "Limpar marcados" → triggers session close + modal
- Modal component: `NewSessionModal` — "Iniciar nova compra?" with Sim/Não buttons
- Add-item form: add qty field (default 1)

### New pages
- `BaseListPage` (`/lista/base`) — table of base items, inline edit, add form
- `HistoricoPage` (`/lista/historico`) — tabs: Sessões / Por item

### Navigation
- Add tabs or sub-nav links on `/lista` page: Lista | Base | Histórico

---

## Out of Scope (this sub-projeto)

- Integration with financial transactions module
- Price tracking per item
- Barcode scanning
- Sharing list with other users
- Push notifications for shopping reminders

---

## Success Criteria

1. User can manage a base list of recurring items
2. Checking out (Limpar marcados) saves history and optionally pre-populates from base list
3. Items have quantities, editable inline
4. History shows sessions and per-item frequency
5. No regression on existing add/toggle/delete flows
