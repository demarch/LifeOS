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

function toDateString(d: Date | string): string {
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return String(d).split('T')[0];
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
        const bank = (pa as any).institutionNumber ?? pa.name.split(' ')[0];
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
            limit: pa.creditData?.creditLimit ?? null,
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
              date: toDateString(pt.date),
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
