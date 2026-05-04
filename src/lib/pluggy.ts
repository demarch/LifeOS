import { PluggyClient } from 'pluggy-sdk';
import { db } from '@/db/client';
import { accounts, transactions, bills, subscriptions, syncLog } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { bankColor, extractBankName } from './bank-colors';
import { findBillCandidates, findSubscriptionCandidates } from './auto-detect';

// Credit card invoice accounts returned by Pluggy — not real accounts
const INVOICE_ACCOUNT_RE = /\bfatur[a]/i;

// Invoice payment transactions in checking — these are debt settlements, not expenses
const INVOICE_PAYMENT_RE =
  /pagamento.{0,12}fatura|pagto.{0,8}fat|pgt.{0,8}fatura|pagamento.{0,12}cart[aã]o|pagto.{0,8}cart[aã]o|fatura.{0,8}cart[aã]o|d[eé]b.{0,6}aut.{0,12}fatura|d[eé]b.{0,6}aut.{0,12}cart[aã]o/i;

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
        // Skip invoice sub-accounts (faturas abertas/fechadas returned as separate accounts)
        if (INVOICE_ACCOUNT_RE.test(pa.name)) continue;

        const bank = extractBankName(pa.name);
        const paType = (pa as any).type as string;
        const type = paType === 'CREDIT' ? 'credit'
          : paType === 'INVESTMENT' ? 'investment'
          : 'checking';
        // last4 is only meaningful for credit cards (pa.number = "5217")
        // checking account numbers (e.g. "00042779-3") are not card numbers
        const last4 = type === 'credit'
          ? ((pa.number ?? '').replace(/\D/g, '').slice(-4) || null)
          : null;
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

        // Investment accounts don't have transactional data relevant to cash flow
        if (type === 'investment') continue;

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

            // Invoice payments from checking are internal transfers — exclude from expense totals
            const txType = INVOICE_PAYMENT_RE.test(pt.description)
              ? 'transfer'
              : pt.type.toLowerCase();

            db.insert(transactions).values({
              id: randomUUID(),
              pluggyId: pt.id,
              accountId: acct.id,
              description: pt.description,
              amount,
              type: txType,
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
  const allAccts = db.select().from(accounts).all();
  const checkingIds = new Set(allAccts.filter(a => a.type === 'checking').map(a => a.id));

  // Wipe previous auto-detections before re-running so stale data never accumulates.
  // Preserve bills that the user has already reviewed (needsReview=0) or paid.
  db.delete(subscriptions).where(eq(subscriptions.source, 'auto')).run();
  db.delete(bills).where(and(eq(bills.source, 'auto'), eq(bills.needsReview, 1))).run();

  // Subscriptions: detected from all non-transfer debits (credit card charges are the source)
  const nonTransferTxs = allTxs.filter(t => t.type !== 'transfer');
  const subCandidates = findSubscriptionCandidates(nonTransferTxs);
  for (const c of subCandidates) {
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

  // Bills: only checking account debits — credit card transactions are not "contas a pagar"
  const checkingTxs = nonTransferTxs.filter(t => checkingIds.has(t.accountId));
  const billCandidates = findBillCandidates(checkingTxs);
  for (const c of billCandidates) {
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
