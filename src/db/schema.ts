import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id:         text('id').primaryKey(),
  pluggyId:   text('pluggy_id').unique(),
  name:       text('name').notNull(),
  bank:       text('bank').notNull(),
  type:       text('type').notNull(),
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
  amount:      real('amount').notNull(),
  type:        text('type').notNull(),
  category:    text('category').notNull().default(''),
  date:        text('date').notNull(),
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

export const cashFlowMonths = sqliteTable('cash_flow_months', {
  id:             text('id').primaryKey(),
  key:            text('key').notNull().unique(),
  name:           text('name').notNull(),
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
  source:      text('source').notNull().default('manual'),
  sourceRefId: text('source_ref_id'),
  createdAt:   integer('created_at').notNull(),
}, t => ({
  uniqSrc: uniqueIndex('cash_flow_entries_src_uniq').on(t.monthId, t.source, t.sourceRefId),
}));

export const positions = sqliteTable('positions', {
  id:            text('id').primaryKey(),
  pluggyId:      text('pluggy_id').unique(),
  accountId:     text('account_id').references(() => accounts.id),
  ticker:        text('ticker').notNull(),
  name:          text('name').notNull(),
  assetClass:    text('asset_class').notNull(),
  quantity:      real('quantity').notNull(),
  avgPrice:      real('avg_price').notNull(),
  currentValue:  real('current_value').notNull(),
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

export type Account           = typeof accounts.$inferSelect;
export type Transaction       = typeof transactions.$inferSelect;
export type Bill              = typeof bills.$inferSelect;
export type Subscription      = typeof subscriptions.$inferSelect;
export type BaseListItem      = typeof baseListItems.$inferSelect;
export type ShoppingItem      = typeof shoppingItems.$inferSelect;
export type ShoppingSession   = typeof shoppingSessions.$inferSelect;
export type ShoppingSessionItem = typeof shoppingSessionItems.$inferSelect;
export type SyncLogEntry      = typeof syncLog.$inferSelect;
export type CashFlowMonth     = typeof cashFlowMonths.$inferSelect;
export type CashFlowEntry     = typeof cashFlowEntries.$inferSelect;
export type Position          = typeof positions.$inferSelect;
export type QuoteCacheEntry   = typeof quotesCache.$inferSelect;
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
