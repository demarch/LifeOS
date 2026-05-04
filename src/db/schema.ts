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
